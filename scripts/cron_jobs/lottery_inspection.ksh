#!/bin/ksh

SCRIPTDIR=$(cd $(dirname $0);echo $PWD)
pid=$SCRIPTDIR+"/lottery_inspection.pid"
trap "rm -f $pid" SIGSEGV
trap "rm -f $pid" SIGINT

if [ -e $pid ]; then
    echo "script is already running"
    exit # pid file exists, another instance is running, so now we exit
else
    echo $$ > $pid # pid file doesn't exit, create one and go on
fi


cd $SCRIPTDIR; cd ../..
git pull
# if a new version of the script was pulled, we need to update the permission to execute
chmod +x scripts/cron_jobs/*.ksh
case "$SCRIPTDIR" in
  *staging*) export HARDHAT_NETWORK=fantomtestnet ;;
  *)         export HARDHAT_NETWORK=fantom ;;
esac
/home/ubuntu/.nvm/versions/node/v16.13.0/bin/node scripts/lottery_inspection.js

rm -f $pid # remove pid file before exiting
exit