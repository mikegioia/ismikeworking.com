<?php

/**
 * Compiles the daily HTML file, stores a copy in the backup folder
 * and then updates the current one. This script uses the data in the
 * data folder for determining if Mike is working today.
 *
 * The computation for working/not working is computed in the series
 * of checks in src/Generator.php.
 */

require 'src/Common.php';
require 'src/Compiler.php';

define('TIMEZONE', 'America/New_York');

// Set the timezone to the server
date_default_timezone_set(TIMEZONE);

// Write a new file to web/
(new Compiler)->run(
    __DIR__.'/data',
    __DIR__.'/web',
    __DIR__.'/template.phtml'
);
