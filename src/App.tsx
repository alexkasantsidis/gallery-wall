import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Viewport } from './canvas/Viewport';
import { boot } from './store/persistence';
import { useUi } from './store/uiStore';
import { useShortcuts } from './hooks/useShortcuts';
import { Toolbar } from './panels/Toolbar';
import { LeftPanel } from './panels/LeftPanel';
import { Inspector } from './panels/Inspector';
import { Navigator } from './panels/Navigator';
import { CanvasMenu } from './panels/CanvasMenu';
import { Modals } from './panels/Modals';
import { HangPanel } from './panels/HangPanel';
import { Calibrator } from './panels/Calibrator';
import { CropEditor } from './photos/CropEditor';

function Toast() {
  const toast = useUi((s) => s.toast);
  return (
    <div className="pointer-events-none fixed top-20 left-1/2 z-50 -translate-x-1/2">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass rounded-xl px-3.5 py-2 text-[12.5px] text-ink-200"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid h-full place-items-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-col items-center gap-3 text-[13px] text-ink-400">
        <motion.div
          className="h-10 w-8 rounded-[3px] border-[3px] border-accent/80"
          animate={{ rotate: [0, 0, 90, 90, 0], scale: [1, 0.9, 1, 0.9, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        Hanging the first pictures…
      </motion.div>
    </div>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  useShortcuts();
  useEffect(() => {
    let alive = true;
    boot().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider>
        <div className="fixed inset-0 overflow-hidden">
          {ready ? (
            <>
              <CanvasMenu>
                <div className="absolute inset-0">
                  <Viewport />
                </div>
              </CanvasMenu>
              <Calibrator />
              <Toolbar />
              <LeftPanel />
              <Inspector />
              <Navigator />
              <HangPanel />
              <CropEditor />
              <Modals />
              <Toast />
            </>
          ) : (
            <Loading />
          )}
        </div>
      </Tooltip.Provider>
    </MotionConfig>
  );
}
