import { useEffect, useRef } from 'react';
import './DisplayPlayer.css';

interface Campaign {
  id: string;
  name: string;
  mediaUrl: string;
  localUrl?: string; // from electron cache
  mediaType: string;
  duration: number;
}

export function DisplayPlayer({ campaign, onEnded }: { campaign: Campaign, onEnded: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    // For images, we need a manual timer since they don't have an 'onEnded' event
    if (campaign.mediaType === 'image') {
      const timer = setTimeout(() => {
        onEnded();
      }, campaign.duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [campaign, onEnded]);

  return (
    <>
      {campaign.mediaType === 'image' ? (
        <img src={campaign.localUrl || campaign.mediaUrl} alt="Ad" className="display-media" />
      ) : (
        <video 
          ref={videoRef}
          src={campaign.localUrl || campaign.mediaUrl} 
          autoPlay 
          muted 
          onEnded={onEnded}
          className="display-media"
          // fallback to duration timer if video fails to play or ends early
        />
      )}
    </>
  );
}
