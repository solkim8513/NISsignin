jest.mock('../src/db/pool', () => ({
  query: jest.fn()
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,TEST')
}));

jest.mock('../src/services/emailService', () => ({
  sendVisitorSigninNotification: jest.fn().mockResolvedValue({ sent: false, skipped: true })
}));

const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db/pool');

describe('Visitor sign-in routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates public visitor sign-in', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'v1',
          full_name: 'Jane Visitor',
          company: 'NIS',
          email: 'jane@example.com',
          phone: '555-1010',
          purpose_of_visit: 'Meeting',
          visit_date: '2026-03-10',
          submitted_at: '2026-03-10T12:00:00.000Z'
        }
      ]
    });

    const response = await request(app).post('/api/visitor-signins/public').send({
      full_name: 'Jane Visitor',
      company: 'NIS',
      email: 'jane@example.com',
      phone: '555-1010',
      purpose_of_visit: 'Meeting'
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.signin.full_name).toBe('Jane Visitor');
    expect(response.body.email_notification).toBeDefined();
  });

  test('returns QR metadata', async () => {
    const response = await request(app).get('/api/visitor-signins/qr');

    expect(response.status).toBe(200);
    expect(response.body.url).toContain('/visitor-signin');
    expect(response.body.image_data_url).toContain('data:image/png;base64');
  });
});
