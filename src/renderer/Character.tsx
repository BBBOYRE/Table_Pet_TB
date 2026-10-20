import type { PetAction } from '../shared/contracts'

/** Original vector test artwork. No external model, texture, font, or runtime. */
export function Character({ action = 'idle', token = 0, interactive = false }: { action?: PetAction; token?: number; interactive?: boolean }) {
  return <svg className={`character action-${action}`} viewBox="0 0 240 300" role="img" aria-label="小芽，二维动态测试角色">
    <defs>
      <linearGradient id="hair" x2="0.8" y2="1"><stop stopColor="#405e60"/><stop offset="1" stopColor="#243c43"/></linearGradient>
      <linearGradient id="coat" x2="0.8" y2="1"><stop stopColor="#c4e2c6"/><stop offset="1" stopColor="#88bba5"/></linearGradient>
    </defs>
    <ellipse cx="120" cy="281" rx="63" ry="10" fill="#30564c" opacity=".12" pointerEvents="none"/>
    <g key={token} className="figure" data-interactive={interactive || undefined}>
      <path d="M65 105 Q37 150 56 192 L77 207 L79 129Z" fill="url(#hair)" stroke="#263d42" strokeWidth="3"/>
      <path d="M173 101 Q204 150 187 192 L163 206 L161 125Z" fill="url(#hair)" stroke="#263d42" strokeWidth="3"/>
      <g className="legs" stroke="#3d5554" strokeWidth="3" strokeLinejoin="round">
        <path d="M88 233 L87 270 Q98 281 108 270 L112 235" fill="#f9e7d9"/>
        <path d="M130 235 L134 270 Q145 281 155 270 L151 233" fill="#f9e7d9"/>
        <path d="M87 261 L107 261 L109 275 Q96 284 82 276Z" fill="#4b6661"/>
        <path d="M133 261 L154 261 L159 276 Q145 284 132 275Z" fill="#4b6661"/>
      </g>
      <g className="arm arm-left" stroke="#3d5554" strokeWidth="3" strokeLinejoin="round">
        <path d="M79 169 Q59 172 49 211 Q48 224 61 226 L83 196Z" fill="url(#coat)"/>
        <path d="M49 210 Q38 226 48 231 Q59 238 64 220" fill="#f9e7d9"/>
      </g>
      <path d="M85 160 Q119 149 153 160 L167 236 Q120 254 73 236Z" fill="url(#coat)" stroke="#3d5554" strokeWidth="3"/>
      <path d="M100 161 L120 181 L139 160" fill="#f7f4e6" stroke="#52796b" strokeWidth="2.5"/>
      <path d="M120 182 L120 239" fill="none" stroke="#6b9e89" strokeWidth="2"/>
      <circle cx="126" cy="197" r="2.6" fill="#f7f4e6"/><circle cx="126" cy="214" r="2.6" fill="#f7f4e6"/>
      <path d="M84 212 Q99 215 108 212 L105 228 L86 228Z" fill="#d9ead3" stroke="#75a08a" strokeWidth="2"/>
      <path d="M96 220 Q84 211 93 207 Q101 207 96 220 Q108 208 110 216 Q110 223 96 220" fill="#4e8871"/>
      <g className="arm arm-right" stroke="#3d5554" strokeWidth="3" strokeLinejoin="round">
        <path d="M155 169 Q178 172 188 210 Q190 224 176 226 L154 195Z" fill="url(#coat)"/>
        <path d="M185 208 Q199 222 190 230 Q179 238 173 221" fill="#f9e7d9"/>
      </g>
      <g className="head">
        <path d="M59 97 Q54 37 119 36 Q188 36 183 101 L176 143 Q155 172 119 173 Q82 171 63 142Z" fill="#ffe9d8" stroke="#3d5554" strokeWidth="3"/>
        <path d="M57 109 Q39 79 65 46 Q83 25 120 29 Q160 24 180 53 Q199 80 182 114 L167 89 L161 64 Q141 96 107 101 L117 74 Q91 104 67 110 L67 90Z" fill="url(#hair)" stroke="#263d42" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M75 51 Q99 34 123 38" stroke="#6b9290" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".7"/>
        <g className="eyes">
          <ellipse cx="90" cy="122" rx="9" ry="12" fill="#304a4b"/>
          <ellipse cx="150" cy="122" rx="9" ry="12" fill="#304a4b"/>
          <circle cx="87" cy="118" r="3.4" fill="white"/><circle cx="147" cy="118" r="3.4" fill="white"/>
          <path d="M83 130 Q90 134 97 130 M143 130 Q150 134 157 130" stroke="#86b09d" strokeWidth="3"/>
        </g>
        <ellipse cx="73" cy="139" rx="10" ry="5" fill="#eea29b" opacity=".5"/>
        <ellipse cx="167" cy="139" rx="10" ry="5" fill="#eea29b" opacity=".5"/>
        <path className="mouth" d="M113 145 Q120 151 127 145" fill="none" stroke="#a0645c" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M151 67 L166 61 M154 73 L169 67" stroke="#edc78b" strokeWidth="4" strokeLinecap="round"/>
        <g className="sprout"><path d="M121 31 Q121 19 128 11" stroke="#547d5d" strokeWidth="3" fill="none"/><path d="M125 20 Q103 19 106 7 Q126 3 125 20Z" fill="#8bbd7c" stroke="#547d5d" strokeWidth="2"/><path d="M125 20 Q132 1 145 7 Q147 21 125 20Z" fill="#acd290" stroke="#547d5d" strokeWidth="2"/></g>
      </g>
    </g>
    {action === 'happy' && <g className="sparkles" fill="#d1a05f" pointerEvents="none"><path d="M36 101 l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"/><path d="M201 70 l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/></g>}
    {action === 'thinking' && <g className="thought" pointerEvents="none"><circle cx="193" cy="45" r="5" fill="#c8d9d0"/><circle cx="211" cy="31" r="8" fill="#dfe9df"/><text x="202" y="27" fontSize="25" fill="#608572">?</text></g>}
  </svg>
}
