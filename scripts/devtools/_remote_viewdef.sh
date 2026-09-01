#!/bin/bash
sudo -u postgres psql -d zhitu_crawl_db -tAc "SELECT pg_get_viewdef('public.the_total_table'::regclass, true);"
echo '---'
sudo -u postgres psql -d zhitu_crawl_db -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='map_data_table' ORDER BY ordinal_position;"
