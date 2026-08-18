import { useEffect, useState } from 'react';

interface Props {
  show: boolean;
  onComplete: () => void;
}

export function WrongAnswerVideoOverlay({ show, onComplete }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete();
      }, 10000); // 10초 재생

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 h-[225px] w-[400px] overflow-hidden rounded-lg border-2 border-[var(--color-wa)] bg-black shadow-2xl transition-all">
      <div className="relative h-full w-full">
        <iframe
          src="https://www.youtube.com/embed/0GnA8VYOfko?start=14&autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3"
          title="Wrong Answer Video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 scale-[1.15]"
        />
      </div>
    </div>
  );
}
