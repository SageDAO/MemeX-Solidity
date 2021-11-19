const AWS = require('aws-sdk');
var winston = require('winston');
var WinstonCloudWatch = require('winston-cloudwatch');

AWS.config.update({
    region: 'us-east-2',

});

// function to create a logger
function createLogger(logGroupName, logStreamName) {
    return new winston.createLogger({
        format:
            winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.json(),
            ),
        transports: [
            new (winston.transports.Console)({
                timestamp: true,
                colorize: true,
            }),
            new WinstonCloudWatch({
                logGroupName: logGroupName,
                logStreamName: logStreamName,
            }),
        ]
    });
}


module.exports = createLogger;