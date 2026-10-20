<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ExternalRequestLog;
use App\Models\ExternalRequestLogEntity;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RequestHistoryController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_request_logs'), 403);

        $direction = $request->query('direction');
        $service = $request->query('service');
        $action = $request->query('action');
        $statusCode = $request->query('status_code');
        $from = $request->query('from');
        $to = $request->query('to');
        $search = $request->query('search');
        $entityType = $request->query('entity_type');
        $entityRid = $request->query('entity_rid');
        $success = $request->query('success');

        $query = ExternalRequestLog::query()
            ->with(['user:id,rid,name,email', 'entities'])
            ->orderByDesc('created_at');

        if (is_string($direction) && $direction !== '') {
            $query->where('direction', $direction);
        }

        if (is_string($service) && $service !== '') {
            $query->where('service', $service);
        }

        if (is_string($action) && $action !== '') {
            $query->where('action', $action);
        }

        if (is_string($statusCode) && $statusCode !== '') {
            $query->where('status_code', (int) $statusCode);
        }

        if ($success === '1' || $success === '0') {
            $query->where('success', $success === '1');
        }

        if (is_string($from) && $from !== '') {
            $query->whereDate('created_at', '>=', $from);
        }

        if (is_string($to) && $to !== '') {
            $query->whereDate('created_at', '<=', $to);
        }

        if (is_string($search) && $search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like): void {
                $q->where('request_url', 'like', $like)
                    ->orWhere('service', 'like', $like)
                    ->orWhere('action', 'like', $like)
                    ->orWhere('request_method', 'like', $like)
                    ->orWhere('exception_message', 'like', $like)
                    ->orWhere('rid', 'like', $like);
            });
        }

        if (is_string($entityType) && $entityType !== '' && is_string($entityRid) && $entityRid !== '') {
            $query->whereHas('entities', function ($q) use ($entityType, $entityRid): void {
                $q->where('entity_type', $entityType)
                    ->where('entity_rid', $entityRid);
            });
        }

        $logs = $query->paginate((int) config('admin.per_page'))->withQueryString()->through(
            fn (ExternalRequestLog $log) => $this->serializeLog($log, includeBodies: false),
        );

        return Inertia::render('Admin/RequestHistory/Index', [
            'logs' => $logs,
            'filters' => [
                'direction' => is_string($direction) ? $direction : '',
                'service' => is_string($service) ? $service : '',
                'action' => is_string($action) ? $action : '',
                'status_code' => is_string($statusCode) ? $statusCode : '',
                'success' => is_string($success) ? $success : '',
                'from' => is_string($from) ? $from : '',
                'to' => is_string($to) ? $to : '',
                'search' => is_string($search) ? $search : '',
                'entity_type' => is_string($entityType) ? $entityType : '',
                'entity_rid' => is_string($entityRid) ? $entityRid : '',
            ],
            'services' => ExternalRequestLog::query()->distinct()->orderBy('service')->pluck('service')->values()->all(),
            'actions' => ExternalRequestLog::query()->whereNotNull('action')->distinct()->orderBy('action')->pluck('action')->values()->all(),
            'directions' => ['incoming', 'outgoing'],
            'entityTypes' => ExternalRequestLogEntity::query()->distinct()->orderBy('entity_type')->pluck('entity_type')->values()->all(),
        ]);
    }

    public function forEntity(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_request_logs'), 403);

        $entityType = $request->query('entity_type');
        $entityRid = $request->query('entity_rid');

        if (! is_string($entityType) || $entityType === '' || ! is_string($entityRid) || $entityRid === '') {
            abort(404);
        }

        $logs = ExternalRequestLog::query()
            ->with(['user:id,rid,name,email', 'entities'])
            ->whereHas('entities', function ($q) use ($entityType, $entityRid): void {
                $q->where('entity_type', $entityType)
                    ->where('entity_rid', $entityRid);
            })
            ->orderByDesc('created_at')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (ExternalRequestLog $log) => $this->serializeLog($log, includeBodies: false));

        return Inertia::render('Admin/RequestHistory/Entity', [
            'logs' => $logs,
            'entityType' => $entityType,
            'entityRid' => $entityRid,
        ]);
    }

    public function show(Request $request, ExternalRequestLog $log): Response
    {
        abort_unless($request->user('staff')?->can('view_request_logs'), 403);

        $log->load(['user:id,rid,name,email', 'entities']);

        return Inertia::render('Admin/RequestHistory/Show', [
            'log' => $this->serializeLog($log, includeBodies: true),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLog(ExternalRequestLog $log, bool $includeBodies): array
    {
        /** @var User|null $user */
        $user = $log->user;

        $payload = [
            'rid' => $log->rid,
            'direction' => $log->direction,
            'service' => $log->service,
            'action' => $log->action,
            'requestMethod' => $log->request_method,
            'requestUrl' => $log->request_url,
            'statusCode' => $log->status_code,
            'success' => $log->success,
            'durationMs' => $log->duration_ms,
            'exceptionClass' => $log->exception_class,
            'exceptionMessage' => $log->exception_message,
            'guard' => $log->guard,
            'meta' => $log->meta,
            'createdAt' => $log->created_at?->toIso8601String(),
            'user' => $user === null ? null : [
                'rid' => $user->rid,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'entities' => $log->entities->map(fn (ExternalRequestLogEntity $entity) => [
                'entityType' => $entity->entity_type,
                'entityRid' => $entity->entity_rid,
            ])->values()->all(),
        ];

        if ($includeBodies) {
            $payload['requestHeaders'] = $this->decodeJsonColumn($log->request_headers);
            $payload['requestBody'] = $log->request_body;
            $payload['responseHeaders'] = $this->decodeJsonColumn($log->response_headers);
            $payload['responseBody'] = $log->response_body;
        }

        return $payload;
    }

    private function decodeJsonColumn(?string $value): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        $decoded = json_decode($value, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }
}
