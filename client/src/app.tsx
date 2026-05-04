// Verify shared types are reachable from the client — type-only import, no runtime cost.
import type {} from '../../shared/types';

export function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>AbleSet Sync — scaffold OK</h1>
      <p>Placeholder component. Will be replaced when prototype is ported.</p>
    </div>
  );
}
