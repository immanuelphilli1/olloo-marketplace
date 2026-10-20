<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

final class ExampleTest extends TestCase
{
    public function test_health_endpoint_is_ok(): void
    {
        $this->get('/up')->assertOk();
    }
}
