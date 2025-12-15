import React from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect }) => {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
    '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
    '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
    '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
    '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
    '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
    '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
    '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
    '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
    '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
    '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸',
    '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋',
    '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞',
    '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇',
    '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏',
    '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳',
    '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃',
    '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
    '👄', '💋', '🩸', '👶', '🧒', '👦', '👧', '🧑',
    '👱', '👨', '🧔', '👩', '🧓', '👴', '👵', '🙍',
    '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦',
    '🤷', '👮', '🕵️', '💂', '🥷', '👷', '🤴', '👸',
    '👳', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼',
    '🎅', '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜',
    '🧝', '🧞', '🧟', '💆', '💇', '🚶', '🧍', '🧎',
    '🏃', '💃', '🕺', '🕴️', '👯', '🧖', '🧗', '🤺',
    '🏇', '⛷️', '🏂', '🏌️', '🏄', '🚣', '🏊', '⛹️',
    '🏋️', '🚴', '🚵', '🤸', '🤼', '🤽', '🤾', '🤹',
    '🧘', '🛀', '🛌', '👭', '👫', '👬', '💏', '💑',
    '👪', '🗣️', '👤', '👥', '🫂', '👣', '🦰', '🦱',
    '🦳', '🦲', '🐵', '🐒', '🦍', '🦧', '🐶', '🐕',
    '🦮', '🐕‍🦺', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈',
    '🐈‍⬛', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄',
    '🦓', '🦌', '🦬', '🐮', '🐂', '🐃', '🐄', '🐷',
    '🐖', '🐗', '🐽', '🐏', '🐑', '🐐', '🐪', '🐫',
    '🦙', '🦒', '🐘', '🦣', '🦏', '🦛', '🐭', '🐁',
    '🐀', '🐹', '🐰', '🐇', '🐿️', '🦫', '🦔', '🦇',
    '🐻', '🐻‍❄️', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘',
    '🦡', '🐾', '🦃', '🐔', '🐓', '🐣', '🐤', '🐥',
    '🐦', '🐧', '🕊️', '🦅', '🦆', '🦢', '🦉', '🦤',
    '🪶', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎',
    '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬',
    '🦭', '🐟', '🐠', '🐡', '🦈', '🐙', '🐚', '🐌',
    '🦋', '🐛', '🐜', '🐝', '🪲', '🐞', '🦗', '🕷️',
    '🕸️', '🦂', '🦟', '🪰', '🪱', '🦠', '💐', '🌸',
    '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷',
    '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄',
    '🌾', '💫', '⭐', '🌟', '✨', '⚡', '☄️', '💥',
    '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️',
    '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄',
    '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌍',
    '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖',
    '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '🌡️', '☀️',
    '🔆', '🔅', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️',
    '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨',
    '💧', '💦', '☔', '☂️', '🌊'
  ];

  return (
    <div className={cn("rounded-2xl shadow-2xl p-4 w-80 max-h-72 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 border",
      isDark 
        ? "bg-gray-800 border-gray-600" 
        : "bg-white border-gray-200")}>
      <div className="mb-3">
        <h3 className={cn("text-sm font-semibold mb-2", 
          isDark ? "text-gray-200" : "text-gray-700")}>Choose an emoji</h3>
        <div className={cn("h-px bg-gradient-to-r from-transparent to-transparent", 
          isDark ? "via-gray-600" : "via-gray-200")}></div>
      </div>
      <div className={cn("max-h-52 overflow-y-auto scrollbar-thin", 
        isDark 
          ? "scrollbar-thumb-gray-600 scrollbar-track-gray-800" 
          : "scrollbar-thumb-gray-300 scrollbar-track-gray-100")}>
        <div className="grid grid-cols-8 gap-1">
          {emojis.map((emoji, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={() => onEmojiSelect(emoji)}
              className={cn("p-2 h-10 w-10 text-lg hover:scale-110 transition-all duration-150 rounded-xl",
                isDark ? "hover:bg-gray-700" : "hover:bg-blue-50")}
              style={{ animationDelay: `${index * 10}ms` }}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;