#!/bin/bash
set -e
echo '=== .env PG_ ==='
grep -E '^PG_' /opt/zhitu/.env 2>/dev/null || true
echo '=== databases ==='
sudo -u postgres psql -d postgres -c '\l' | grep -E 'crawl|zhitu|zhilian' || true
echo '=== map/total/job tables ==='
sudo -u postgres psql -d zhitu_crawl_db -c "\dt" | grep -Ei 'map|total|job' || true
echo '=== map_data_table schema ==='
sudo -u postgres psql -d zhitu_crawl_db -c '\d map_data_table' || echo 'NO map_data_table'
echo '=== the_total_table schema ==='
sudo -u postgres psql -d zhitu_crawl_db -c '\d the_total_table' || echo 'NO the_total_table'
echo '=== counts ==='
sudo -u postgres psql -d zhitu_crawl_db -tAc "SELECT 'map_data_table', count(*) FROM map_data_table" 2>/dev/null || echo 'map_data_table missing'
sudo -u postgres psql -d zhitu_crawl_db -tAc "SELECT 'the_total_table', count(*) FROM the_total_table" 2>/dev/null || echo 'the_total_table missing'
sudo -u postgres psql -d zhitu_crawl_db -tAc "SELECT 'map_data_table', count(*) FROM map_data_table" 2>/dev/null || echo 'map_data_table missing'
echo '=== map sample cols ==='
sudo -u postgres psql -d zhitu_crawl_db -c "SELECT * FROM map_data_table LIMIT 1" 2>/dev/null || true
echo DONE
