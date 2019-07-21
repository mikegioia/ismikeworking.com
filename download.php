<?php

/**
 * Downloads the events and stores them in the data folder.
 * This should be run whenever the season schedules change,
 * which is often for the Champions and Europa Leagues, but
 * not that often for the Premier League.
 */

require 'src/Download.php';

if (! function_exists('curl_version')) {
    echo 'cURL extension not installed', PHP_EOL;
    exit(1);
}

// Save all files to /data
(new Download)->run(__DIR__.'/data');
