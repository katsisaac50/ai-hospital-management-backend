const request = require('supertest');
const app = require('../app');

describe('Drug Interaction API', () => {
  it('should return no interaction between unknown drugs', async () => {
    const res = await request(app).get('/api/v1/interactions/check?drug1=a&drug2=b');
    expect(res.statusCode).toBe(200);
    expect(res.body.interaction).toBe(false);
  });

  it('should create and detect a drug interaction', async () => {
    const interaction = {
      drugA: 'testdrug1',
      drugB: 'testdrug2',
      description: 'Testing interaction logic',
      severity: 'mild',
    };

    await request(app).post('/api/v1/interactions').send(interaction);

    const res = await request(app).get('/api/v1/interactions/check?drug1=testdrug1&drug2=testdrug2');
    expect(res.statusCode).toBe(200);
    expect(res.body.interaction).toBe(true);
    expect(res.body.data.description).toMatch(/Testing/);
  });
});
