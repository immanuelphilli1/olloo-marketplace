<?php

declare(strict_types=1);

namespace App\Enums;

enum EmailLogStatus: string
{
    case Queued = 'queued';
    case Sending = 'sending';
    case Sent = 'sent';
    case Failed = 'failed';
}
