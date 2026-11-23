import { createRoot } from 'react-dom/client';
import { QuotePage } from './QuotePage';

const token = location.pathname.split('/').filter(Boolean)[1] ?? '';
createRoot(document.getElementById('root')!).render(<QuotePage token={token} />);
