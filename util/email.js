const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "notification@sage.art",
        pass: process.env.MAIL_SERVICE_KEY
    }
});
function sendMail(to, subject, header, message, img, link, action, logger) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
        </head>
        <body style="margin: 0">
            <center
                style="
                    max-width: 600px;
                    margin-left: auto;
                    margin-right: auto;
                    background-color: #fff;
                "
            >
                <h1
                    style="
                        border: none;
                        margin-top: 40px;
                        text-transform: uppercase;
                        font-family: 'Marine';
                        font-weight: 400;
                        font-size: 20px;
                        line-height: 136.6%;
                        text-align: center;
                        letter-spacing: 0.1em;
                    "
                >
                    ${header}
                </h1>
                <h4
                    style="
                        margin-top: 24px;
                        text-transform: uppercase;
                        font-family: 'Marine';
                        font-weight: 400;
                        font-size: 12px;
                        line-height: 130%;
                        text-align: center;
                        color: #161619;
                    "
                >
                    ${message}
                </h4>
                <img
                    src="${img}"
                    alt="sdf"
                    class="content-img"
                    style="
                        display: block;
                        margin-top: 20px;
                        width: 311px;
                        height: 300px;
                        margin-left: auto;
                        margin-right: auto;
                    "
                />
                <a
                    href="${link}"
                    target="_blank"
                    style="text-decoration: none"
                >
                    <button
                        style="
                            display: block;
                            text-decoration: none;
                            width: 311px;
                            vertical-align: center;
                            height: 51px;
                            font-family: 'Marine';
                            margin-top: 32px;
                            background-color: red;
                            border: none;
                            border-radius: 0;
                            color: #fff;
                            text-transform: uppercase;
                            font-size: 14px;
                            line-height: 130%;
                            text-align: center;
                            letter-spacing: 0.2em;
                            text-transform: uppercase;
                            cursor: pointer;
                        "
                    >
                        ${action}
                    </button>
                </a>
                <table style=""></table>
                <h5
                    style="
                        margin-top: 39px;
                        font-family: 'Marine';
                        font-style: normal;
                        font-weight: 400;
                        font-size: 8px;
                        line-height: 9px;
                        letter-spacing: 0.1em;
                        color: #161619;
                    "
                >
                    SAGE™️ - ALL RIGHTS RESERVED
                </h5>
            </center>
        </body>
    </html>
`;
    var mailOptions = {
        from: "notification@sage.art",
        to: to,
        subject: subject,
        html: html
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            logger.error(error);
        } else {
            logger.info("email sent");
        }
    });
}

module.exports = sendMail;
