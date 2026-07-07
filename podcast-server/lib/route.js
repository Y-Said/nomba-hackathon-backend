const crypto = require("crypto")
const { DB } = require("../db/db.js")

let accessToken = "";
let lastAccessTime = 0
var db = new DB()
let refreshToken = ""
let expired_at = ""

async function getAccessToken() {
    console.log(process.env.NOMBA_ACCOUNT_ID, process.env.NOMBA_CLIENT_ID, process.env.NOMBA_CLIENT_SECRET)
    const options = {
        method: 'POST',
        headers: { accountId: process.env.NOMBA_ACCOUNT_ID, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: process.env.NOMBA_CLIENT_ID,
            client_secret: process.env.NOMBA_CLIENT_SECRET
        })
    };

    let resp = await fetch('https://sandbox.nomba.com/v1/auth/token/issue', options)
    let data = await resp.json();
    console.log(data)
    accessToken = data.data.access_token;
    lastAccessTime = new Date();
    refreshToken = data.data.refresh_token
    expired_at = data.data.expired_at
}

async function refreshingToken() {

    const options = {
        method: 'POST',
        headers: {
            accountId: process.env.NOMBA_ACCOUNT_ID,
            Authorization: `Bearer <${accessToken}>`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            expired_at: expired_at.toUTCString(),
            grant_type: 'refresh_token',
            refresh_token: `${refreshToken}`
        })
    };

    let response = await fetch('https://sandbox.nomba.com/v1/auth/token/refresh', options)
    let data = await response.json();

    accessToken = data.data.access_token
    lastAccessTime = (new Date()).toLocaleDateString()

}

module.exports.checkOutOrder = async (req, res) => {

    if (accessToken == "") {
        await getAccessToken();
    }

    console.log(req.body, "body")
    let decodedData = JSON.parse(req.body.toString())
    let uniqueID = decodedData.uniqueID

    let timeDelta = (new Date(expired_at)) - lastAccessTime;

    if (timeDelta <= 55 * 60 * 1000) {
        await refreshingToken()
    }

    const response = await fetch('https://sandbox.nomba.com/v1/checkout/order', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'accountId': process.env.NOMBA_ACCOUNT_ID,
        },
        body: JSON.stringify({
            order: {
                amount: `${1000 * 100.0}`,
                currency: 'NGN',
                callbackUrl: process.env.WEB_HOOK_URL,
                customerId: uniqueID

            },
        }),
    });

    const { code, data } = await response.json();

    if (code !== '00') throw new Error(`Checkout creation failed: ${code}`);

    // Redirect or display the checkout link to your customer
    const { checkoutLink, orderReference } = data;
    db.storeOrder(uniqueID,orderReference, )
    res.json({ url: checkoutLink, statusCode: 200 })
}


module.exports.getTodayPodcast = (req, res) => {
    let body = req.body.toString();
    let data = JSON.stringify(body)
    let result = db.getTodayPodcast(data.uniqueID);
    result["billingState"] = db.checkUserBilling(data.uniqueID);
    res.json(result)
}

module.exports.createUser = (req, res) => {
    let body = req.body.toString()
    let data = JSON.parse(body)
    console.log(data)
    db.createUser(data.uniqueID)
    res.json({ status: "Ok", statusCode: 200 })
}

module.exports.webhook = async (req, res) => {
    let now = new Date()
    if (lastAccessTime == 0) {
        await getAccessToken();
    }


    let timeDelta = (new Date(expired_at)) - lastAccessTime;
    if (timeDelta <= (55 * 60 * 1000)) {
        refreshingToken()
    }

    let payload = req.body.toString();
    if (compareSignature(req, payload)) {
        let parsedData = JSON.parse(payload)

        let requestId = parsedData.requestId;
        let transactionId = parsedData.data.transaction.transactionId
        let amount = parsedData.data


        if (db.notDuplicate(requestId)) {
            if (amount < 1000 * 100.0 || amount > 1000 * 100.0) {
                res.json({ status: "Error! Fund in excess or less than 1000", statusCode: 401 })
            }
            db.createTransaction(requestId)

            db.billUser(parsedData.data.order.orderReference);
        }

        else {
            res.json({ "statusCode": 401, status: "Error" })
        }





    }

}

async function compareSignature(req, payload) {

    const signatureValue = req.headers["nomba-signature"]
    const nombaTimeStamp = req.headers["nomba-timestamp"]
    const secret = process.env.NOMBA_CLIENT_SECRET;

    const mySig = generateSignature(payload, secret, nombaTimeStamp);


    return signatureValue.toLowerCase() === mySig.toLowerCase();

}

function generateSignature(payload, secret, timeStamp) {
    const requestPayload = JSON.parse(payload);
    const data = requestPayload.data || {};
    const merchant = data.merchant || {};
    const transaction = data.transaction || {};

    const eventType = requestPayload.event_type || "";
    const requestId = requestPayload.requestId || "";
    const userId = merchant.userId || "";
    const walletId = merchant.walletId || "";
    const transactionId = transaction.transactionId || "";
    const transactionType = transaction.type || "";
    const transactionTime = transaction.time || "";
    let transactionResponseCode = transaction.responseCode || "";

    if (transactionResponseCode === "null") {
        transactionResponseCode = "";

    }
    const hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${transactionResponseCode}:${timeStamp}`;

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(hashingPayload);
    const hash = hmac.digest("base64");

    return hash;
}

