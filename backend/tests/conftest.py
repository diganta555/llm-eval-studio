from app.db.models.test_case import TestCase

# Tell pytest not to treat the SQLAlchemy ORM model 'TestCase' as a pytest test class
TestCase.__test__ = False
