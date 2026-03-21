import { preventNoSQLInjection, preventXSS, validateContentType } from '../middlewares/inputValidation.middleware';
import { requestId, sanitizeInput, suspendedAccountCheck } from '../middlewares/security.middleware';

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

describe('Security middlewares', () => {
  test('sanitizeInput trims body fields', () => {
    const req: any = { body: { first_name: '  Jean  ' } };
    sanitizeInput(req, mockRes(), jest.fn());
    expect(req.body.first_name).toBe('Jean');
  });

  test('sanitizeInput does not modify password fields', () => {
    const req: any = { body: { password: '  Secret  ' } };
    sanitizeInput(req, mockRes(), jest.fn());
    expect(req.body.password).toBe('  Secret  ');
  });

  test('preventXSS rejects script tags', () => {
    const req: any = { body: { comment: '<script>alert(1)</script>' } };
    const res = mockRes();
    preventXSS(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('preventNoSQLInjection rejects $where', () => {
    const req: any = { body: { email: { $where: 'this.password' } }, query: {}, params: {} };
    const res = mockRes();
    preventNoSQLInjection(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('requestId adds X-Request-ID header', () => {
    const req: any = {};
    const res = mockRes();
    requestId(req, res, jest.fn());
    expect(req.requestId).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
  });

  test('validateContentType blocks missing json content type', () => {
    const req: any = { method: 'POST', headers: { 'content-type': 'text/plain', 'content-length': '10' } };
    const res = mockRes();
    validateContentType(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(415);
  });

  test('suspendedAccountCheck blocks suspended users', () => {
    const req: any = { user: { status: 'suspended' } };
    const res = mockRes();
    suspendedAccountCheck(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
