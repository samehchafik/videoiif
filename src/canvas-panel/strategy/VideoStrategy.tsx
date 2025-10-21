import type React from "react";
import { useStrategy } from "../../context/StrategyContext";
import { ThumbnailFallbackImage } from "../render/ThumbnailFallbackImage";
import { Video, type VideoComponentProps } from "../render/Video";
import { useRenderControls } from "../../context/ControlsContext";
import { SingleVideo } from "../../features/rendering-strategy/resource-types";

interface RenderVideoStrategyProps {
	as?: React.ComponentType<VideoComponentProps>;
}

export function RenderVideoStrategy({
	as: CustomVideo,
}: RenderVideoStrategyProps) {
	const { strategy } = useStrategy();
	const { renderMediaControls, mediaControlsDeps } = useRenderControls();
	/*let media : SingleVideo;

	if(strategy.type === "complex-timeline"){
		for(let n=0; n <  strategy.items.length; n ++){
			let item = strategy.items[n];
			if(item.type === "Video"){
				media = item
			}
		}
	}
	else{ 
		if (strategy.type !== "media" || strategy.media.type !== "Video") return null;
		else{
			media = strategy.media
		}
	}*/
	if (strategy.type !== "media" || strategy.media.type !== "Video") return null;

	return (
		<Video
			key={strategy.media.url}
			captions={strategy.captions}
			media={strategy.media}
			mediaControlsDeps={mediaControlsDeps}
			videoComponent={CustomVideo}
		>
			<ThumbnailFallbackImage />
			{renderMediaControls ? renderMediaControls(strategy) : null}
		</Video>
	);
}
