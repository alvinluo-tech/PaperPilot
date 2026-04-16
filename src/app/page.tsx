import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/database/supabase/server';
import { Sidebar } from './components/layout/Sidebar';
import { MainEditor } from './components/editor/MainEditor';
import { RightPanel } from './components/inspector/RightPanel';
import { DocumentProvider } from './context/DocumentContext';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DocumentProvider>
      <div className="flex h-screen w-full bg-white overflow-hidden font-sans">
        {/* Left Column: Navigation & Outline */}
        <Sidebar />
        
        {/* Middle Column: Editor */}
        <MainEditor />

        {/* Right Column: AI Inspector & Tools */}
        <RightPanel />
      </div>
    </DocumentProvider>
  );
}