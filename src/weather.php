<?php

class Weather
{
    const WOODSIDE = '94062,US';
    const WEST_CHESTER = '19380,US';

    const API_WEATHER = 'http://api.openweathermap.org/data/2.5/weather?q=%s&appid=%s';

    /**
     * Queries the weather for a given location and stores it in the
     * specified data directory.
     *
     * @param string $key API key
     * @param string $folder Folder to store data
     */
    public function run(string $key, string $folder)
    {
        //
    }
}