import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://localhost:3000';

// Test configuration
export const options = {
    stages: [
        { duration: '30s', target: 100 }, // Ramp up to 100 users
        { duration: '2s', target: 100 },  // Stay at 100 for 1 minute
        { duration: '30s', target: 200 }, // Ramp up to 200
        { duration: '1m', target: 200 },  // Stay at 200 for 1 minute
        { duration: '30s', target: 0 },   // Ramp down to 0
    ],
};

// Generate test data
function generateOrder() {
    return {
        orderId: `order_${Math.random().toString(36).slice(2)}`,
        userId: `user_${Math.random().toString(36).slice(2)}`,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: [{
            productId: 'test_product',
            name: 'Test Product',
            quantity: 1,
            price: 99.99,
            metadata: {
                color: 'blue',
                size: 'M',
                weight: 1.5,
                tags: ['test']
            }
        }],
        shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            country: 'Test',
            postalCode: '12345',
            location: {
                latitude: 40.7128,
                longitude: -74.0060,
                accuracy: 100,
                timestamp: Date.now()
            }
        },
        billingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            country: 'Test',
            postalCode: '12345',
            location: {
                latitude: 40.7128,
                longitude: -74.0060,
                accuracy: 100,
                timestamp: Date.now()
            }
        },
        payment: {
            cardType: 'visa',
            lastFourDigits: '4242',
            expiryMonth: 12,
            expiryYear: 2025,
            billingAddress: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                country: 'Test',
                postalCode: '12345',
                location: {
                    latitude: 40.7128,
                    longitude: -74.0060,
                    accuracy: 100,
                    timestamp: Date.now()
                }
            }
        },
        metadata: {
            platform: 'test',
            userAgent: 'k6-test',
            sessionId: 'test-session',
            preferences: {
                giftWrap: false,
                insurance: true,
                notifications: {
                    email: true,
                    sms: false,
                    push: true
                }
            }
        }
    };
}

export default function() {
    const payload = JSON.stringify(generateOrder());
    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const dhiRes = http.post(`${BASE_URL}/api/dhi/orders`, payload, params);
    check(dhiRes, { 'DHI status is 200': (r) => r.status === 200 });

    const zodRes = http.post(`${BASE_URL}/api/zod/orders`, payload, params);
    check(zodRes, { 'Zod status is 200': (r) => r.status === 200 });

    sleep(1);
} 