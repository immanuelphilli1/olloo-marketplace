<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\EnvGuard;
use Illuminate\Support\Env;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class EnvGuardTest extends TestCase
{
    #[Test]
    public function it_accepts_a_plain_path_segment(): void
    {
        $this->assertSame('x7k9mPq2vL5nJw', EnvGuard::adminPathPrefix('x7k9mPq2vL5nJw'));
    }

    #[Test]
    public function it_trims_surrounding_whitespace(): void
    {
        // A stray space from a heredoc or a YAML block would otherwise produce an
        // nginx directive that parses but never matches.
        $this->assertSame('abc123', EnvGuard::adminPathPrefix("  abc123\n"));
    }

    /**
     * The failure this exists for: `ADMIN_PATH_PREFIX=` is present but empty, and
     * its default does not apply, so the portal would mount at the site root
     * and the gateway would refuse to parse `location ^~ //`.
     */
    #[Test]
    #[DataProvider('invalidPrefixes')]
    public function it_rejects_values_that_would_break_routing(string $prefix, string $expectedInMessage): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/'.preg_quote($expectedInMessage, '/').'/');

        EnvGuard::adminPathPrefix($prefix);
    }

    public static function invalidPrefixes(): array
    {
        return [
            'empty' => ['', 'ADMIN_PATH_PREFIX is empty'],
            'whitespace only' => ["  \t ", 'ADMIN_PATH_PREFIX is empty'],
            'leading slash' => ['/admin', "must not start with '/'"],
            'trailing slash' => ['admin/', "must not end with '/'"],
            'a full path' => ['secret/admin', 'single path segment'],
            'leading dash' => ['-admin', "must not start with '/' or '-'"],
        ];
    }

    /**
     * The fallback the config file ships must itself pass, or a fresh install
     * with no ADMIN_PATH_PREFIX set cannot boot.
     *
     * Read from the source rather than from config('admin.path_prefix'): the
     * resolved value is environment-specific, since any local .env overrides the
     * fallback, and pinning the resolved value would fail on every developer
     * machine that set its own prefix.
     */
    #[Test]
    public function the_literal_fallback_in_the_config_file_is_valid(): void
    {
        $source = file_get_contents(config_path('admin.php'));

        $this->assertIsString($source);
        $this->assertSame(
            1,
            preg_match("/env\('ADMIN_PATH_PREFIX', '([^']*)'\)/", $source, $matches),
            'Could not find the ADMIN_PATH_PREFIX fallback in config/admin.php.'
        );

        $this->assertSame($matches[1], EnvGuard::adminPathPrefix($matches[1]));
    }

    /**
     * Whatever this environment resolves to must also be usable, provided it is
     * set at all. Empty is covered by the data provider above.
     */
    #[Test]
    public function the_resolved_prefix_passes_the_guard(): void
    {
        $resolved = trim((string) config('admin.path_prefix'));

        if ($resolved === '') {
            $this->markTestSkipped('ADMIN_PATH_PREFIX is empty here; the guard is expected to reject it.');
        }

        $this->assertSame($resolved, EnvGuard::adminPathPrefix($resolved));
    }

    /**
     * Guards the assumption the whole feature rests on: the config helper
     * returns the variable when it is present and empty, so the fallback does
     * not apply.
     * If this ever stops being true the gateway template becomes optional
     * instead of mandatory, and the docs need rewriting.
     */
    #[Test]
    public function an_empty_value_does_not_fall_back_to_the_config_default(): void
    {
        Env::getRepository()->set('ADMIN_PATH_PREFIX', '');

        try {
            // Read the config file rather than calling the helper here. The helper
            // is only allowed inside config/, which is exactly where this call
            // lives, and NoEnvOutsideConfigTest enforces that. Requiring the file
            // also runs its own resolution instead of asserting a hardcoded value,
            // so this test would still mean something if config/admin.php changed.
            $resolved = require config_path('admin.php');

            $this->assertSame(
                '',
                $resolved['path_prefix'],
                'An empty ADMIN_PATH_PREFIX resolved to the fallback, so the staff portal would not mount at the root.'
            );
        } finally {
            Env::getRepository()->clear('ADMIN_PATH_PREFIX');
        }
    }
}
