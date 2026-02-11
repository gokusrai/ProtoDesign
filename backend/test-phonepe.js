import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || 1;
const HOST_URL = process.env.PHONEPE_HOST_URL;

async function testPayment() {
    console.log("--- Testing PhonePe Credentials ---");
    console.log(`MID: ${MERCHANT_ID}`);
    console.log(`URL: ${HOST_URL}`);

    const payload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: "TEST_" + Date.now(),
        merchantUserId: "TEST_USER",
        amount: 10000, // ₹100.00
        redirectUrl: "http://localhost:8080",
        redirectMode: "REDIRECT",
        callbackUrl: "http://localhost:3001/callback",
        mobileNumber: "9999999999",
        paymentInstrument: { type: "PAY_PAGE" }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const stringToHash = base64Payload + '/pg/v1/pay' + SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = sha256 + '###' + SALT_INDEX;

    try {
        const response = await axios.post(
            `${HOST_URL}/pg/v1/pay`,
            { request: base64Payload },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                    'accept': 'application/json'
                }
            }
        );
        console.log("✅ SUCCESS! Redirect URL:", response.data.data.instrumentResponse.redirectInfo.url);
    } catch (error) {
        console.error("❌ FAILED:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Code: ${error.response.headers['x-api-exception-code']}`); // Look for CK015
            console.error("Data:", error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

testPayment();