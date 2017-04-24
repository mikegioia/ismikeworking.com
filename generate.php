<?php

/**
 * Generates a new daily HTML file using the configuration.
 * This will create an archive file and update index.html.
 * By default, "dryRun" is enabled and will output the HTML
 * and not write any files. Set this argument to 0 to actually
 * save the files and run silently.
 *
 * Usage: generate.php "/path/to/www" "today|YYYY-MM-DD" [dryRun]
 */

// Set up maximum error reporting and UTC time
const TODAY = 'today';
error_reporting( E_ALL );
ini_set( 'display_errors', 1 );
date_default_timezone_set( 'UTC' );

$dryRun = TRUE;
$usage = "Usage: generate.php '/path/to/www' 'today|YYYY-MM-DD' [dryRun=1]";

// Data for the template
$data = (object) [
    'when' => "",
    'reason' => "",
    'timestamp' => NULL,
    'isWorking' => FALSE,
    'funFact' => (object) [
        'id' => 0,
        'text' => "",
        'isActive' => FALSE
    ]
];

if ( ! isset( $argv ) || is_null( $argv ) || count( $argv ) < 2 ):
    echo $usage . PHP_EOL;
    exit( 1 );
endif;

// Check path is writable
if ( ! is_writeable( $argv[ 1 ] ) ):
    echo "File path '", $argv[ 1 ], "' is not writeable", PHP_EOL;
    exit( 1 );
endif;

// Check the date is valid
if ( count( $argv ) > 2 && $argv[ 2 ] !== TODAY ):
    $p = explode( "-", $argv[ 2 ] );

    if ( count( $p ) !== 3
        || ! checkdate( (int) $p[ 1 ], (int) $p[ 2 ], (int) $p[ 0 ] ) ):
        echo "Date must be 'today' or YYYY-MM-DD", PHP_EOL;
        exit( 1 );
    endif;

    // Store the timestamp
    $data->timestamp = mktime(
        date( "H" ),
        date( "i" ),
        date( "s" ),
        $p[ 1 ],
        $p[ 2 ],
        $p[ 0 ] );
else:
    $data->timestamp = time();
endif;

// Store the dry run flag
if ( count( $argv ) > 3 && $argv[ 3 ] == 0 ):
    $dryRun = FALSE;
endif;

// Format dates
function formatTime ( $time ) {
    $p = explode( ":", $time );

    if ( $p[ 0 ] >= 12 ):
        return ($p[ 0 ] - 12) .":". $p[ 1 ] ." pm EST";
    endif;

    return $time ." am EST";
}

// Lookup and update the fun fact
function funFact ( $day, &$data, $funFacts ) {
    if ( ! isset( $day->funfact ) ):
        return;
    endif;

    foreach ( $funFacts as $funFact ):
        if ( $day->funfact == $funFact->id ):
            $data->funFact->active = TRUE;
            $data->funFact->id = $funFact->id;
            $data->funFact->text = $funFact->text;
        endif;
    endforeach;
}

// Generate the template HTML
function template ( $file, $data ) {
    extract( (array) $data );
    ob_start();
    include $file;
    return ob_get_clean();
}

// Load the days and config files
$dateKey = date( "Y-m-d", $data->timestamp );
$days = json_decode( file_get_contents( __DIR__ ."/days.json" ) );
$config = json_decode( file_get_contents( __DIR__ ."/config.json" ) );
$funFacts = json_decode( file_get_contents( __DIR__ ."/funfacts.json" ) );

// Now, try to figure out what the best message to show is.
// 1. Look for any hard coded day in the days file
foreach ( $days as $day ):
    if ( $day->date == $dateKey ):
        $data->when = ( isset( $day->when ) )
            ? $day->when ." "
            : "";
        $data->when .= ( isset( $day->start ) )
            ? sprintf(
                "Not from %s to %s",
                formatTime( $day->start ),
                formatTime( $day->end ) )
            : "";
        $data->reason = $day->text;
        funFact( $day, $data, $funFacts );
        goto generate;
    endif;
endforeach;

// 2. Check the current day against the config file
// 2a. Active premier league weekend
// 2b. Italian class on friday
// 2c. Non-PL weekend in the summer
// 3. Show the default working message

// Jump point to generate the files
generate: {
    $html = template( __DIR__ ."/template.phtml", $data );

    if ( $dryRun ):
        echo $html;
        exit;
    endif;

    mkdir( $argv[ 1 ] ."/archive", 0755, TRUE );
    file_put_contents( $argv[ 1 ] ."/index.html", $html );
    file_put_contents( $argv[ 1 ] ."/archive/$dateKey.html", $html );
}