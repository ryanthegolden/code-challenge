import { Router } from 'express';
import {
  createItem,
  listItems,
  getItem,
  updateItem,
  deleteItem,
} from '../controllers/itemController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);
router.post('/items', createItem);
router.get('/items', listItems);
router.get('/items/:id', getItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

export default router;
