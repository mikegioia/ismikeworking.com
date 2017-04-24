# Is Mike Working?

Usage:

```
$> php generate.php "/path/to/www" "today|YYYY-MM-DD" [dryRun]
```

For example, this would write `index.html` and `archive/2017-04-24.html`
(today's date):

```
$> php generate.php "/var/www/example/org/www-data" "today" 0
```

The last argument, `dryRun`, can be 1 or 0, and it defaults to 1. When
`dryRun` is set to 1, it will output the HTML instead of writing any
files.

The second argument can be "today" or a date string in the format
"YYYY-MM-DD".
