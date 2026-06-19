import TabButton from '../common/TabButton.jsx';
import { useUiStore } from '../../state/uiStore.js';
import { useCanvasStore } from '../../state/canvasStore.js';

/**
 * CanvasTabsBar Component.
 * Renders the top tabs bar for choosing, creating, renaming, and deleting canvas tabs.
 */
export default function CanvasTabsBar({
  users,
  handleSwitchTab,
  handleDeleteTab,
  handleRenameTab,
  handleCreateTab
}) {
  const { showTabsBar } = useUiStore();
  const { tabs, activeTabId } = useCanvasStore();

  return (
    <div className={`flex items-center justify-between backdrop-blur-md bg-slate-900/30 border border-slate-800/80 rounded-xl p-1.5 shadow-lg z-20 overflow-hidden transition-all duration-300 ease-in-out ${
      showTabsBar
        ? 'max-h-16 opacity-100 mb-4'
        : 'max-h-0 opacity-0 mb-0 p-0 border-0 pointer-events-none'
    }`}>
      <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-4 py-0.5 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const tabUsers = users.filter((u) => (u.activeTabId || 'tab-default') === tab.id);

          return (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={isActive}
              tabUsers={tabUsers}
              onSwitch={handleSwitchTab}
              onDelete={handleDeleteTab}
              onRename={handleRenameTab}
              isDeleteDisabled={tabs.length <= 1}
            />
          );
        })}
      </div>
      
      <button
        onClick={handleCreateTab}
        className="p-2 bg-slate-800/80 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-lg transition active:scale-95 flex items-center justify-center cursor-pointer shadow-md border border-slate-700/50 flex-shrink-0"
        title="Create New Canvas"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
}
