#!/bin/sh
echo "[Azure WebJob] Starting daily seed for TWSE odd lots and gifts..."
cd /home/site/wwwroot
npm run seed --workspace=packages/database
echo "[Azure WebJob] Daily seed completed successfully."
