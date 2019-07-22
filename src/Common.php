<?php

class Common
{
    /**
     * Returns the current season slug. If we're in July -> December, use the
     * current and next years. If we're in January -> June, use the preview and
     * current years.
     *
     * @return string
     */
    public static function getSlug()
    {
        $dt = new DateTime;
        $year = intval($dt->format('Y'));
        $month = intval($dt->format('n'));

        // Last 2 digits of the years
        $curYear = substr($year, -2);
        $nextYear = substr($year + 1, -2);
        $lastYear = substr($year - 1, -2);

        return $month >= 7
            ? $curYear.$nextYear
            : $lastYear.$curYear;
    }
}