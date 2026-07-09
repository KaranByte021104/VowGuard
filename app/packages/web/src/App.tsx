import { Outlet } from 'react-router-dom';
import { Navigation } from './components/Navigation';

function App() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar placeholder */}
        <header className="h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center px-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            SecureVault
          </h2>
        </header>
        
        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
