<?php

class Download
{
    const LEAGUES = [
        'Champions League' => 4480,
        'Europa League' => 4481,
        'Premier League' => 4328
    ];

    const CHAMPIONS_LEAGUE = 'Champions League';
    const EUROPA_LEAGUE = 'Europa League';
    const PREMIER_LEAGUE = 'Premier League';

    /**
     * The ID is a number from the LEAGUES constant, and the `s` param
     * denotes the season slug: 1920, 2021, etc.
     */
    const API_EVENTS_SEASON = 'https://thesportsdb.com/api/v1/json/1/eventsseason.php?id=%s&s=%s';

    /**
     * Downloads the league events data and stores in the data folder.
     *
     * @param string $folder Path to store the event files
     */
    public function run(string $folder)
    {
        $slug = Common::getSlug();

        foreach (self::LEAGUES as $name => $id) {
            $data = $this->getData($id, $slug);

            $this->storeData($data, $folder, $slug, $name);
        }
    }

    /**
     * Fetches the data from the server.
     *
     * @param int $id League ID
     * @param string $slug Season slug
     *
     * @return stdClass
     */
    private function getData(string $id, string $slug)
    {
        $url = sprintf(self::API_EVENTS_SEASON, $id, $slug);

        $ch = curl_init();

        // Return the response, if false it print the response
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_URL, $url);

        $result = curl_exec($ch);

        curl_close($ch);

        $json = json_decode($result);

        if (! $json || ! isset($json->events)) {
            echo 'Events not found for ', $url, PHP_EOL;
            exit(1);
        }

        return $json;
    }

    /**
     * Stores the data in the data folder with the right name.
     *
     * @param stdClass $data JSON event data
     * @param string $folder Path to store file
     * @param string $name League name
     */
    private function storeData(stdClass $data, string $folder, string $slug, string $name)
    {
        $filename = sprintf('%s_%s.json', $slug, str_replace(' ', '_', $name));

        // Store an original copy of the data
        $json = $this->getCleanJson($data->events);

        file_put_contents($folder.'/original/'.$filename, $json);

        // Save a backup
        $dateFolder = (new DateTime)->format('Ymd');
        @mkdir($folder.'/backup/'.$dateFolder, 0755, true);
        file_put_contents($folder.'/backup/'.$dateFolder.'/'.$filename, $json);

        // Process the events and store them in a different format
        $events = $this->getEvents($data->events);
        $json = $this->getCleanJson($events);

        file_put_contents($folder.'/'.$filename, $json);
    }

    /**
     * Converts an original data set into a smaller and more manageable
     * set of events for the app to work with.
     *
     * @param array $originalEvents
     *
     * @return array
     */
    private function getEvents(array $originalEvents)
    {
        $events = [];

        foreach ($originalEvents as $event) {
            $dt = new DateTime($event->dateEvent.' '. $event->strTime);

            $events[] = [
                'id' => $event->idEvent,
                'date' => $event->dateEvent,
                'time' => $event->strTime,
                'title' => $event->strEvent,
                'home' => $event->strHomeTeam,
                'away' => $event->strAwayTeam,
                'timestamp' => $dt->getTimestamp(),
                'about' => trim(sprintf('%s %s',
                    $event->strDescriptionEN ?? '',
                    $event->strFilename ?? ''
                ))
            ];
        }

        return $events;
    }

    /**
     * Returns JSON formatted with two spaces.
     *
     * @param array $data
     *
     * @return string
     */
    private function getCleanJson(array $data) {
        return preg_replace_callback('/^ +/m', function ($m) {
            return str_repeat (' ', strlen ($m[0]) / 2);
        }, json_encode($data, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
    }
}