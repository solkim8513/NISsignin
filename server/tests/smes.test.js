const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/db/pool');

jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

const token = jwt.sign(
  { id: 'admin-id', role: 'admin', email: 'admin@example.com' },
  process.env.JWT_SECRET || 'dev_jwt_secret'
);

describe('SME routes', () => {
  test('returns SME list', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 's1', name: 'Jane Doe', skillsets: ['cloud'], availability_status: 'available' }]
    });

    const response = await request(app)
      .get('/api/smes?skillset=cloud&availability=available')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Jane Doe');
  });

  test('creates SME as admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's2', name: 'John Smith' }] });

    const response = await request(app)
      .post('/api/smes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'John Smith', skillsets: ['network'], certifications: [] });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('s2');
  });
});
