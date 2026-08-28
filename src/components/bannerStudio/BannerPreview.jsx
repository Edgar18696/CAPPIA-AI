import {
  forwardRef,
  memo,
} from "react";

const BannerPreview = memo(
  forwardRef(function BannerPreview(
    {
      children,
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  })
);

BannerPreview.displayName =
  "BannerPreview";

export default BannerPreview;