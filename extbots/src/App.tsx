import { Game } from './Game';
import { UI } from './UI';
import { LookArea } from './LookArea';

export default function App() {
  return (
    <div className="w-full h-screen bg-black overflow-hidden relative touch-none select-none">
      <Game />
      <LookArea />
      <UI />
    </div>
  );
}
