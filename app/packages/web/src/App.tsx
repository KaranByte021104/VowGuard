import { Outlet } from 'react-router-dom';
import { Navigation } from './components/Navigation';


function App() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar placeholder */}
        <header className="h-16 border-b border-border bg-card flex items-center px-6">
        </header>
        
        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
