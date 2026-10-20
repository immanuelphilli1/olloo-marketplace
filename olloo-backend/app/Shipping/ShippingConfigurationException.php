<?php

declare(strict_types=1);

namespace App\Shipping;

use RuntimeException;

/**
 * Thrown when no shipping rule matches. Fail closed: the HTTP layer maps
 * this to a 500, never to a silent zero fee.
 */
final class ShippingConfigurationException extends RuntimeException {}
