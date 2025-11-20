import { AnimatePresence, motion } from "framer-motion";
import {
  Image,
  Languages,
  Menu,
  Mic2,
  UserCircle,
  Volume2,
  VolumeX,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { useState } from "react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "../IconButton/IconButton";

export type ControlButtonsViewProps = {
  /**
   * ミュート状態
   */
  isMuted: boolean;

  /**
   * ストリーミングモード状態
   */
  isStreamingMode: boolean;

  /**
   * メニューが開いているかどうか（親に通知用）
   */
  onMenuOpenChange?: (isOpen: boolean) => void;

  /**
   * 言語選択ボタンを押した際のハンドラー
   */
  onOpenLanguageSelector: () => void;

  /**
   * モデル選択ボタンを押した際のハンドラー
   */
  onOpenModelSelector: () => void;

  /**
   * 背景選択ボタンを押した際のハンドラー
   */
  onOpenBackgroundSelector: () => void;

  /**
   * ミュート状態切替のハンドラー
   */
  onToggleMute: () => void;

  /**
   * 音声チャットを開くハンドラー
   */
  onOpenVoiceChat: () => void;

  /**
   * ストリーミングモード切替のハンドラー
   */
  onToggleStreamingMode: () => void;
};

/**
 * 画面右下に配置されるコントロールボタン群のプレゼンテーションコンポーネント
 * @param isMuted - ミュート状態
 * @param onToggleMute - ミュート状態切替のハンドラー
 * @param onOpenVoiceChat - 音声チャットを開くハンドラー
 */
export const ControlButtonsView: FC<ControlButtonsViewProps> = ({
  isMuted,
  isStreamingMode,
  onOpenLanguageSelector,
  onOpenModelSelector,
  onOpenBackgroundSelector,
  onToggleMute,
  onOpenVoiceChat,
  onToggleStreamingMode,
  onMenuOpenChange,
}) => {
  const { t } = useTranslation("chat");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuButtons = [
    {
      id: "mic",
      icon: Mic2,
      label: t("voiceChat"),
      onClick: onOpenVoiceChat,
      isActive: false,
    },
    {
      id: "volume",
      icon: isMuted ? VolumeX : Volume2,
      label: isMuted ? t("unmute") : t("mute"),
      onClick: onToggleMute,
      isActive: !isMuted,
    },
    {
      id: "streaming",
      icon: isStreamingMode ? Zap : ZapOff,
      label: isStreamingMode ? t("streamingMode") : t("nonStreamingMode"),
      onClick: onToggleStreamingMode,
      isActive: isStreamingMode,
    },

    {
      id: "language",
      icon: Languages,
      label: t("selectLanguage"),
      onClick: onOpenLanguageSelector,
      isActive: false,
    },
    {
      id: "background",
      icon: Image,
      label: t("selectBackground"),
      onClick: onOpenBackgroundSelector,
      isActive: false,
    },
    {
      id: "model",
      icon: UserCircle,
      label: t("selectModel"),
      onClick: onOpenModelSelector,
      isActive: false,
    },
  ];

  const handleMenuToggle = () => {
    const newState = !isMenuOpen;
    setIsMenuOpen(newState);
    onMenuOpenChange?.(newState);
  };

  const handleButtonClick = (onClick: () => void) => {
    onClick();
  };

  const handleBackdropClick = () => {
    setIsMenuOpen(false);
    onMenuOpenChange?.(false);
  };

  return (
    <>
      {/* フルスクリーンメニュー */}
      <AnimatePresence>
        {isMenuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
            onClick={handleBackdropClick}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                handleBackdropClick();
              }
            }}
            aria-label="Close menu"
          >
            {/* 閉じるボタン */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="absolute top-4 right-4"
              onClick={(e) => e.stopPropagation()}
            >
              <IconButton
                icon={X}
                onClick={() => {
                  setIsMenuOpen(false);
                  onMenuOpenChange?.(false);
                }}
                aria-label={t("close")}
                className="h-12 w-12 md:h-14 md:w-14"
                iconClassName="size-6 md:size-7"
              />
            </motion.div>

            {/* ボタン群を画面下部に等間隔で配置 */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-6xl px-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 place-items-center">
                {menuButtons.map((button, index) => (
                  <motion.div
                    key={button.id}
                    initial={{ opacity: 0, y: 30, scale: 0.8 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        delay: 0.3 + index * 0.1,
                        duration: 0.3,
                        ease: "easeOut",
                      },
                    }}
                    whileHover={{ scale: 1.1, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-3 cursor-pointer group w-full"
                    onClick={() => handleButtonClick(button.onClick)}
                  >
                    {/* 大きなアイコンボタン */}
                    <div className="relative">
                      {button.isActive && (
                        <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-pulse shadow-lg shadow-blue-500/30" />
                      )}
                      <IconButton
                        icon={button.icon}
                        onClick={() => {}}
                        aria-label={button.label}
                        className={`h-20 w-20 md:h-24 md:w-24 relative z-10 ${
                          button.isActive
                            ? "ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/25"
                            : ""
                        }`}
                        iconClassName="size-5 md:size-6"
                      />
                    </div>

                    {/* ボタンラベル */}
                    <span className="text-sm md:text-base font-medium text-center whitespace-nowrap">
                      {button.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </button>
        )}
      </AnimatePresence>

      {/* 通常時のメニューボタン */}
      {!isMenuOpen && (
        <div className="absolute bottom-4 right-4 z-50">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <IconButton
              icon={Menu}
              onClick={handleMenuToggle}
              aria-label={t("menu")}
              className="h-12 w-12 md:h-14 md:w-14"
              iconClassName="size-3 md:size-4"
            />
          </motion.div>
        </div>
      )}
    </>
  );
};
