<?php

class Compiler
{
    /**
     * @var int Highest current priority
     */
    private $priority = 0;

    /**
     * @var int Severity level, one of the severity constants
     */
    private $severity = self::SEVERITY_YES;

    /**
     * @var string Yes, No, etc
     */
    private $status;

    /**
     * @var string Main reason description
     */
    private $reason;

    /**
     * @var array Collection of full text reason to display. Usually this
     *   is just one, but sometimes multiple events can hit (i.e. a holiday
     *   and Liverpool playing occut on the same day).
     */
    private $reasons = [];

    const PRIORITY_MAX = 9;
    const PRIORITY_HIGH = 3;
    const PRIORITY_MEDIUM = 2;
    const PRIORITY_LOW = 1;

    const SEVERITY_GONE = 4;
    const SEVERITY_NO = 3;
    const SEVERITY_MAYBE = 2;
    const SEVERITY_YES = 1;

    const LIVERPOOL = 'Liverpool';

    const BIG_TEAMS = [
        'Liverpool', 'Tottenham', 'Man United',
        'Chelsea', 'Man City', 'Arsenal',
        'Barcelona', 'Real Madrid', 'Juventus'
    ];

    const HOLIDAYS = [
        '01-01' => [
            'status' => 'Probably',
            'title' => "New Year's Day",
            'severity' => self::SEVERITY_MAYBE,
            'reason' => "New Year's Day is one of the best days to get stuff done!"
        ],
        '02-22' => [
            'status' => 'No',
            'title' => "Steve Irwin's Birthday",
            'severity' => self::SEVERITY_NO,
            'reason' => "It's Steve Irwin's Birthday, which Mike observes outdoors!"
        ],
        '03-03' => [
            'status' => 'No',
            'title' => 'World Wildlife Day',
            'severity' => self::SEVERITY_NO,
            'reason' => "It's World Wildlife Day, which Mike observes at a state or national park!"
        ],
        '04-22' => [
            'status' => 'No',
            'title' => 'Earth Day',
            'severity' => self::SEVERITY_NO,
            'reason' => "It's Earth Day, which Mike observes by planting trees outside!"
        ],
        '08-20' => [
            'status' => 'No way!',
            'title' => "Mike's Birthday",
            'severity' => self::SEVERITY_GONE,
            'reason' => "It's Mike's (and Andrew's) Birthday today!!!"
        ],
        '08-22' => [
            'status' => 'No',
            'title' => 'National Honey Bee Day',
            'severity' => self::SEVERITY_NO,
            'reason' => "It's Narional Honey Bee Day, which Mike observes outdoors in the garden"
        ],
        '11-15' => [
            'status' => 'No',
            'title' => 'Steve Irwin Day',
            'severity' => self::SEVERITY_NO,
            'reason' => "It's Steve Irwin Day, which Mike observes by repeat-watching ".
                '<a href="https://youtu.be/-1gVkTFam1w">his farewell video</a>'
        ],
        '12-25' => [
            'status' => 'Probably',
            'title' => 'Christmas',
            'priority' => self::PRIORITY_HIGH,
            'severity' => self::SEVERITY_MAYBE,
            'reason' => 'Christmas is one of the best days to get stuff done!'
        ]
    ];

    /**
     * Reads in the event data and writes an HTML file with the
     * working status and a message. Each test also carries a
     * priority to use when compiling the message. The highest
     * number will be used.
     *
     * @param string $dataFolder Path to store the event files
     * @param string $webFolder Path to store web files
     * @param string $tplPath Path to template file
     */
    public function run(string $dataFolder, string $webFolder, string $tplPath)
    {
        $slug = Common::getSlug();

        $this->premierLeague($slug, $dataFolder);
        $this->championsLeague($slug, $dataFolder);
        $this->europaLeague($slug, $dataFolder);
        $this->holidays();
        $this->computedHolidays();
        $this->workDays();

        // Writes the HTML file
        $this->write($webFolder, $tplPath);
    }

    /**
     * Writes the HTML file to the web folder and the archive.
     *
     * @param string $webFolder Path to store web files
     * @param string $tplPath Path to template file
     */
    private function write(string $webFolder, string $tplPath)
    {
        $dt = new DateTime;

        ob_start();
        extract([
            'status' => $this->status,
            'reason' => $this->reason,
            'severity' => $this->severity,
            'timestamp' => $dt->format('l F j, Y \a\\t g:i a')
        ]);

        include $tplPath;

        $html = ob_get_clean();

        // Write out the web file for today
        file_put_contents($webFolder.'/index.html', $html);

        // Write the same file to the archive
        $dateFolders = $dt->format('Y/m');
        $day = $dt->format('d');

        @mkdir($webFolder.'/archive/'.$dateFolders, 0755, true);
        file_put_contents($webFolder.'/archive/'.$dateFolders.'/'.$day.'.html', $html);
    }

    /**
     * Checks all premier league conditions.
     *
     * @param string $slug Current month/day slug
     * @param string $folder Directory with data files
     */
    private function premierLeague(string $slug, string $folder)
    {
        $events = $this->getEvents($slug, $folder, 'Premier_League');

        foreach ($events as $event) {
            $this->checkLiverpool($event);
            $this->checkBigGame($event);
            $this->checkAnyPLGame($event);
        }
    }

    /**
     * Checks if the event involves Liverpool.
     *
     * @param stdClass $event
     */
    private function checkLiverpool(stdClass $event)
    {
        if (in_array(self::LIVERPOOL, [$event->home, $event->away])) {
            $this->setMessage([
                'severity' => self::SEVERITY_GONE,
                'priority' => self::PRIORITY_MAX,
                'status' => 'NO WAY!',
                'reason' => sprintf(
                    'Liverpool are playing %s at %s!!!',
                    self::LIVERPOOL === $event->home
                        ? $event->away
                        : $event->home,
                    $this->getEventDate($event)
                )
            ]);
        }
    }

    /**
     * Checks if the event involves two big teams.
     *
     * @param stdClass $event
     */
    private function checkBigGame(stdClass $event)
    {
        // Liverpool games handled elsewhere
        if (in_array(self::LIVERPOOL, [$event->home, $event->away])) {
            return;
        }

        if (in_array($event->home, self::BIG_TEAMS)
            && in_array($event->away, self::BIG_TEAMS)
        ) {
            $this->setMessage([
                'priority' => self::PRIORITY_HIGH,
                'status' => 'NOPE',
                'reason' => sprintf(
                    '%s are playing %s at %s and Mike is definitely watching that!',
                    $event->home,
                    $event->away,
                    $this->getEventDate($event)
                )
            ]);
        } elseif (in_array($event->home, self::BIG_TEAMS)
            || in_array($event->away, self::BIG_TEAMS)
        ) {
            $this->setMessage([
                'priority' => self::PRIORITY_MEDIUM,
                'status' => 'NO',
                'reason' => sprintf(
                    '%s are playing %s at %s and Mike is watching that!',
                    $event->home,
                    $event->away,
                    $this->getEventDate($event)
                )
            ]);
        }
    }

    /**
     * Checks if the event is a PL game not involving a big team.
     *
     * @param stdClass $event
     */
    private function checkAnyPLGame(stdClass $event)
    {
        if (! in_array(self::LIVERPOOL, [$event->home, $event->away])
            && ! in_array($event->home, self::BIG_TEAMS)
            && ! in_array($event->away, self::BIG_TEAMS)
        ) {
            $this->setMessage([
                'status' => 'No',
                'reason' => 'Premier League games are being played today!'
            ]);
        }
    }

    /**
     * Checks all Champions League conditions.
     *
     * @param string $slug Current month/day slug
     * @param srting $folder Directory with data files
     */
    private function championsLeague(string $slug, string $folder)
    {
        $events = $this->getEvents($slug, $folder, 'Champions_League');

        foreach ($events as $event) {
            $this->checkLiverpool($event);
            $this->checkCLFinal($event);
            $this->checkBigGame($event);
            $this->checkAnyCLGame($event);
        }
    }

    /**
     * Checks if the CL final is today.
     *
     * @param stdClass $event
     */
    private function checkCLFinal(stdClass $event)
    {
        if (strpos($event->about, 'Final') !== false) {
            $this->setMessage([
                'status' => 'Nope!',
                'priority' => self::PRIORITY_HIGH,
                'reason' => "Champions League final and that's an all day affair!"
            ]);
        }
    }

    /**
     * Checks if any CL game is today. Higher priority is given to
     * any knockout game or later. This is tough to decipher from
     * the description, so we can try to use the time of the year.
     *
     * @param stdClass $event
     */
    private function checkAnyCLGame(stdClass $event)
    {
        $month = intval((new DateTime)->format('m'));

        if ($month >= 2 && $month <= 3) {
            $this->setMessage([
                'status' => 'No',
                'priority' => self::PRIORITY_LOW,
                'reason' => "Champions League knockout games are being played today!"
            ]);
        } elseif ($month >= 4 && $month <= 5) {
            $this->setMessage([
                'status' => 'Nope',
                'priority' => self::PRIORITY_MEDIUM,
                'reason' => "Late tournament Champions League games are being played today!"
            ]);
        } elseif ($month >= 8) {
            $this->setMessage([
                'status' => 'Probably',
                'priority' => self::PRIORITY_MEDIUM,
                'severity' => self::SEVERITY_MAYBE,
                'reason' => "Champions League group stage games are on in the background"
            ]);
        }
    }

    /**
     * Checks all Europa League conditions.
     *
     * @param string $slug Current month/day slug
     * @param srting $folder Directory with data files
     */
    private function europaLeague(string $slug, string $folder)
    {
        $events = $this->getEvents($slug, $folder, 'Europa_League');

        foreach ($events as $event) {
            $this->checkLiverpool($event);
            $this->checkELFinal($event);
        }
    }

    /**
     * Checks if the EL final is today.
     *
     * @param stdClass $event
     */
    private function checkELFinal(stdClass $event)
    {
        if (strpos($event->about, 'Final') !== false) {
            $this->setMessage([
                'status' => 'Nope!',
                'priority' => self::PRIORITY_HIGH,
                'reason' => "Europa League final is today!"
            ]);
        }
    }

    /**
     * Checks for any standard or alternative work days.
     *
     * @todo Read in weather data for weekends
     */
    private function workDays()
    {
        $dayOfWeek = intval((new DateTime)->format('N'));

        // We only run these if we have no reason set
        if (! $this->reason) {
            if ($dayOfWeek >= 6) {
                // Weekends are off by default
                $this->setMessage([
                    'status' => 'No',
                    'reason' => "It's a rare weekend off and Mike is probably outside!"
                ]);
            } else {
                // Nothing found, default is a work day during the week
                $this->setMessage([
                    'status' => 'Yes',
                    'severity' => self::SEVERITY_YES,
                    'reason' => 'Full work day today'
                ]);
            }
        }
    }

    /**
     * Checks if the current day is a holiday.
     */
    private function holidays()
    {
        $slug = (new DateTime)->format('m-d');

        if (isset(self::HOLIDAYS[$slug])) {
            $this->setMessage(self::HOLIDAYS[$slug]);
        }
    }

    /**
     * Checks for holidays that change their date each year.
     */
    private function computedHolidays()
    {
        $slug = (new DateTime)->format('m-d');

        // Check Easter
        if (date('m-d', easter_date()) === $slug) {
            $this->setMessage([
                'priority' => self::PRIORITY_HIGH,
                'reason' => 'Mike loves to celebrate Easter (eat Easter bread) with his family!'
            ]);
        }
    }

    /**
     * Expects the message to have a status, severity, reason, and
     * optionally a priority and title.
     */
    private function setMessage(array $message)
    {
        $severity = $message['severity'] ?? self::SEVERITY_NO;
        $priority = $message['priority'] ?? self::PRIORITY_LOW;

        if (! $this->priority || $priority > $this->priority) {
            $this->priority = $priority;
            $this->severity = $severity;
            $this->reason = $message['reason'];
            $this->status = $message['status'];
        }

        $this->reasons[] = $message['reason'];
    }

    /**
     * Load the events for the day for a given file.
     *
     * @param string $slug Current month/day slug
     * @param srting $folder Directory with data files
     * @param string $type Type of file to load
     *
     * @return array
     */
    private function getEvents(string $slug, string $folder, string $type)
    {
        $today = [];
        $dateString = (new DateTime)->format('Y-m-d');

        // Load the events
        $filename = sprintf('%s_%s.json', $slug, $type);
        $json = file_get_contents($folder.'/'.$slug.'_'.$type.'.json');
        $events = json_decode($json);

        if (! $events) {
            return [];
        }

        // Process each and pull only those for today
        foreach ($events as $event) {
            if ($dateString === $event->date) {
                $today[] = $event;
            }
        }

        return $today;
    }

    /**
     * Returns a human formatted date for an event.
     *
     * @param stdClass $event
     *
     * @return string
     */
    private function getEventDate(stdClass $event)
    {
        $dt = new DateTime($event->date.' '.$event->time);

        $dt->setTimezone(new DateTimeZone(TIMEZONE));

        return $dt->format('g:i a');
    }
}
