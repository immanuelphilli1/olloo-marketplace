<?php

declare(strict_types=1);

namespace App\Providers;

use App\Currency\CurrencyConverter;
use App\Currency\ShopperLocale;
use App\Listeners\RecordOutboundEmail;
use App\Mail\LoggingMailManager;
use App\Support\EnvGuard;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Mail\MailManager;
use Illuminate\Queue\Events\JobExceptionOccurred;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Replace the mail manager so every transport is wrapped with LoggingTransport.
        $this->app->singleton('mail.manager', function ($app) {
            return new LoggingMailManager($app);
        });

        $this->app->alias('mail.manager', MailManager::class);

        // Rates and the shopper's locale are read once per request (and per queued job).
        $this->app->scoped(CurrencyConverter::class);
        $this->app->scoped(ShopperLocale::class);
    }

    public function boot(): void
    {
        // Fail here, naming app.env, rather than let an empty prefix mount the
        // staff portal at / and take the storefront down with it when the gateway
        // refuses to parse `location ^~ //`.
        EnvGuard::adminPathPrefix((string) config('admin.path_prefix'));

        Event::listen(MessageSending::class, [RecordOutboundEmail::class, 'handleMessageSending']);
        Event::listen(MessageSent::class, [RecordOutboundEmail::class, 'handleMessageSent']);
        Event::listen(JobExceptionOccurred::class, [RecordOutboundEmail::class, 'handleJobExceptionOccurred']);

        $proxies = config('app.trusted_proxies');
        if (is_string($proxies) && $proxies !== '') {
            TrustProxies::at($proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)));
        }
    }
}
