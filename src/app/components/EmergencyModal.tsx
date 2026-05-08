import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Phone, X } from 'lucide-react';
import { Button } from './ui/button';

interface EmergencyModalProps {
  open: boolean;
  onClose: () => void;
}

export function EmergencyModal({ open, onClose }: EmergencyModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md rounded-2xl border-2 border-red-500 bg-white dark:bg-zinc-900 shadow-2xl shadow-red-500/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶部红色警告条 */}
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                <AlertTriangle className="w-7 h-7 text-white" />
              </motion.div>
              <h2 className="text-xl font-bold text-white tracking-wide">紧急情况提示</h2>
              <button
                onClick={onClose}
                className="ml-auto rounded-full p-1 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容 */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-base font-semibold text-red-700 dark:text-red-400 leading-relaxed">
                检测到您描述的症状可能属于<strong>紧急医疗情况</strong>。
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                本工具仅用于整理就诊信息，<strong>无法处理紧急情况</strong>。请立即：
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800">
                  <Phone className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">拨打急救电话</p>
                    <p className="text-xs text-muted-foreground">中国大陆：<strong>120</strong> &nbsp;|&nbsp; 香港：<strong>999</strong> &nbsp;|&nbsp; 美国/加拿大：<strong>911</strong></p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    或立即前往最近的<strong>急诊科（Emergency）</strong>，告知分诊护士您的症状。
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-1">
                如情况允许，可关闭此提示继续整理信息，但请以就医为优先。
              </p>
            </div>

            {/* 底部按钮 */}
            <div className="px-6 pb-5 flex gap-3">
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={() => { window.open('tel:120'); }}
              >
                <Phone className="w-4 h-4" />
                拨打 120
              </Button>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                我已知晓，继续
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
