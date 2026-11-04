import * as React from "react"
import type { Tier } from "../ranks"

// The crests of the ranks, one picture a tier, which the owner draws and hands over as SVG (`RankEmblem` draws them). Each is their file as it came, in a 20 × 20 box: the ids are made unique by a prefix, the attributes are React's, the angular gradients are the
// `conic-gradient` of a `foreignObject` as the design tool exported them, and the three colours are the tokens of the stylesheet (`--crest-*`) instead of their values, a component naming no colour. The paths that the tool also exported as the placeholders of those gradients
// (no fill, so no paint) are left out. Only the tiers the owner has handed over are here: the others keep the stand-in of `RankEmblem`.

/** Grandmaster's crest: a shield with a violet fill from its top to its foot, a pale edge, and a four-pointed star in it. */
function GrandmasterCrest(props: React.ComponentProps<"svg">) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g filter="url(#rank-crest-gm-shadow)">
        <use xlinkHref="#rank-crest-gm-shield" fill="url(#rank-crest-gm-fill)" />
        <mask id="rank-crest-gm-edge" fill="white">
          <use xlinkHref="#rank-crest-gm-shield" />
        </mask>
        <path
          d="M8.16185 2.67303L7.63726 2.45214C5.02839 1.35362 3.72396 0.804357 2.75008 1.06335C1.9006 1.28926 1.18197 1.8838 0.772672 2.6993C0.303431 3.63423 0.502116 4.09829 0.899487 7.02643L1.46113 11.165C1.56813 11.9535 1.62163 12.3477 1.75658 12.706C1.87624 13.0236 2.04264 13.3195 2.24968 13.5826C2.4832 13.8795 2.78585 14.1184 3.39113 14.5963L7.03038 17.4695C8.09529 18.3103 8.62775 18.7307 9.21253 18.8927C9.72872 19.0358 10.2713 19.0358 10.7875 18.8927C11.3723 18.7307 11.9047 18.3103 12.9696 17.4695L16.6089 14.5963C17.2142 14.1184 17.5168 13.8795 17.7503 13.5826C17.9574 13.3195 18.1238 13.0236 18.2434 12.706C18.3784 12.3477 18.4319 11.9535 18.5389 11.165L19.1005 7.02644C19.4979 4.0983 19.6966 3.63423 19.2273 2.6993C18.818 1.8838 18.0994 1.28926 17.2499 1.06335C16.276 0.804357 14.9716 1.35362 12.3627 2.45214L11.8382 2.67303C11.1591 2.95897 10.8196 3.10194 10.469 3.15854C10.1582 3.20873 9.84185 3.20873 9.531 3.15854C9.18044 3.10194 8.84091 2.95897 8.16185 2.67303Z"
          strokeWidth="3.2"
          strokeLinejoin="round"
          stroke="white"
          strokeOpacity="0.4"
          mask="url(#rank-crest-gm-edge)"
        />
      </g>
      <g clipPath="url(#rank-crest-gm-star-clip-1)">
        <g transform="matrix(0 0.003 -0.003 0 10 10)">
          <foreignObject x="-1333.33" y="-1333.33" width="2666.67" height="2666.67">
            <div style={{ background: "conic-gradient(from 90deg, var(--crest-star-light) 0deg, var(--crest-star-shade) 360deg)", height: "100%", width: "100%", opacity: 1 }} />
          </foreignObject>
        </g>
      </g>
      <g clipPath="url(#rank-crest-gm-star-clip-2)">
        <g transform="matrix(-0.003 0 0 -0.003 10 10)">
          <foreignObject x="-1333.33" y="-1333.33" width="2666.67" height="2666.67">
            <div style={{ background: "conic-gradient(from 90deg, var(--crest-star-light) 0deg, var(--crest-star-shade) 360deg)", height: "100%", width: "100%", opacity: 0.5 }} />
          </foreignObject>
        </g>
      </g>
      <mask id="rank-crest-gm-star-edge" maskUnits="userSpaceOnUse" x="6" y="6" width="8" height="8" fill="black">
        <rect fill="white" x="6" y="6" width="8" height="8" />
        <use xlinkHref="#rank-crest-gm-star" />
      </mask>
      <path
        d="M8.74607 8.89262L7.18436 9.69757C6.93855 9.82427 6.93855 10.1757 7.18436 10.3024L8.74607 11.1074C8.80898 11.1398 8.8602 11.191 8.89262 11.2539L9.69757 12.8156C9.82427 13.0615 10.1757 13.0615 10.3024 12.8156L11.1074 11.2539C11.1398 11.191 11.191 11.1398 11.2539 11.1074L12.8156 10.3024C13.0615 10.1757 13.0615 9.82427 12.8156 9.69757L11.2539 8.89262C11.191 8.8602 11.1398 8.80898 11.1074 8.74607L10.3024 7.18436C10.1757 6.93855 9.82427 6.93855 9.69757 7.18436L8.89262 8.74607C8.8602 8.80898 8.80898 8.8602 8.74607 8.89262Z"
        strokeWidth="2"
        stroke="black"
        strokeOpacity="0.16"
        mask="url(#rank-crest-gm-star-edge)"
      />
      <defs>
        <filter id="rank-crest-gm-shadow" x="0.5" y="1" width="19" height="19" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="1" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.106667 0 0 0 0 0 0 0 0 0 0.32 0 0 0 1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <clipPath id="rank-crest-gm-star-clip-1">
          <path d="M9.69757 7.18436C9.82427 6.93855 10.1757 6.93855 10.3024 7.18436L11.1074 8.74607C11.1398 8.80898 11.191 8.8602 11.2539 8.89262L12.8156 9.69757C13.0615 9.82427 13.0615 10.1757 12.8156 10.3024L11.2539 11.1074C11.191 11.1398 11.1398 11.191 11.1074 11.2539L10.3024 12.8156C10.1757 13.0615 9.82427 13.0615 9.69757 12.8156L8.89262 11.2539C8.8602 11.191 8.80898 11.1398 8.74607 11.1074L7.18436 10.3024C6.93855 10.1757 6.93855 9.82427 7.18436 9.69757L8.74607 8.89262C8.80898 8.8602 8.8602 8.80898 8.89262 8.74607L9.69757 7.18436Z" />
        </clipPath>
        <clipPath id="rank-crest-gm-star-clip-2">
          <path d="M9.69757 7.18436C9.82427 6.93855 10.1757 6.93855 10.3024 7.18436L11.1074 8.74607C11.1398 8.80898 11.191 8.8602 11.2539 8.89262L12.8156 9.69757C13.0615 9.82427 13.0615 10.1757 12.8156 10.3024L11.2539 11.1074C11.191 11.1398 11.1398 11.191 11.1074 11.2539L10.3024 12.8156C10.1757 13.0615 9.82427 13.0615 9.69757 12.8156L8.89262 11.2539C8.8602 11.191 8.80898 11.1398 8.74607 11.1074L7.18436 10.3024C6.93855 10.1757 6.93855 9.82427 7.18436 9.69757L8.74607 8.89262C8.80898 8.8602 8.8602 8.80898 8.89262 8.74607L9.69757 7.18436Z" />
        </clipPath>
        <linearGradient id="rank-crest-gm-fill" x1="10.0004" y1="-2.34296" x2="10.0004" y2="22.0737" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "var(--crest-grandmaster-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--crest-grandmaster-bottom)" }} />
        </linearGradient>
        <path
          id="rank-crest-gm-shield"
          d="M0.899487 7.02643C0.502116 4.09829 0.303431 3.63423 0.772672 2.6993C1.18197 1.8838 1.9006 1.28926 2.75008 1.06335C3.72396 0.804357 5.02839 1.35362 7.63726 2.45214L8.16185 2.67303C8.84091 2.95897 9.18044 3.10194 9.531 3.15854C9.84185 3.20873 10.1582 3.20873 10.469 3.15854C10.8196 3.10194 11.1591 2.95897 11.8382 2.67303L12.3627 2.45214C14.9716 1.35362 16.276 0.804357 17.2499 1.06335C18.0994 1.28926 18.818 1.8838 19.2273 2.6993C19.6966 3.63423 19.4979 4.0983 19.1005 7.02644L18.5389 11.165C18.4319 11.9535 18.3784 12.3477 18.2434 12.706C18.1238 13.0236 17.9574 13.3195 17.7503 13.5826C17.5168 13.8795 17.2142 14.1184 16.6089 14.5963L12.9696 17.4695C11.9047 18.3103 11.3723 18.7307 10.7875 18.8927C10.2713 19.0358 9.72872 19.0358 9.21253 18.8927C8.62775 18.7307 8.09529 18.3103 7.03038 17.4695L3.39113 14.5963C2.78585 14.1184 2.4832 13.8795 2.24968 13.5826C2.04264 13.3195 1.87624 13.0236 1.75658 12.706C1.62163 12.3477 1.56813 11.9535 1.46113 11.165L0.899487 7.02643Z"
        />
        <path
          id="rank-crest-gm-star"
          d="M9.69757 7.18436C9.82427 6.93855 10.1757 6.93855 10.3024 7.18436L11.1074 8.74607C11.1398 8.80898 11.191 8.8602 11.2539 8.89262L12.8156 9.69757C13.0615 9.82427 13.0615 10.1757 12.8156 10.3024L11.2539 11.1074C11.191 11.1398 11.1398 11.191 11.1074 11.2539L10.3024 12.8156C10.1757 13.0615 9.82427 13.0615 9.69757 12.8156L8.89262 11.2539C8.8602 11.191 8.80898 11.1398 8.74607 11.1074L7.18436 10.3024C6.93855 10.1757 6.93855 9.82427 7.18436 9.69757L8.74607 8.89262C8.80898 8.8602 8.8602 8.80898 8.89262 8.74607L9.69757 7.18436Z"
        />
      </defs>
    </svg>
  )
}

/** The crest of each tier that has one: the others are drawn by the stand-in of `RankEmblem`. */
const CRESTS: Partial<Record<Tier, (props: React.ComponentProps<"svg">) => React.JSX.Element>> = { Grandmaster: GrandmasterCrest }

export { CRESTS, GrandmasterCrest }
