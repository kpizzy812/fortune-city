import Image from 'next/image';

interface CurrencyIconProps {
  currency: 'SOL' | 'USDT_SOL' | 'FORTUNE';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: 24, badge: 8 },
  md: { icon: 32, badge: 10 },
  lg: { icon: 40, badge: 12 },
};

export function CurrencyIcon({ currency, size = 'md', className = '' }: CurrencyIconProps) {
  const { icon, badge } = SIZE_MAP[size];

  if (currency === 'SOL') {
    return (
      <div className={`relative inline-block ${className}`}>
        <Image
          src="/sol.png"
          alt="Solana"
          width={icon}
          height={icon}
          className="rounded-full"
        />
      </div>
    );
  }

  if (currency === 'USDT_SOL') {
    return (
      <div className={`relative inline-block ${className}`}>
        <Image
          src="/usdt.png"
          alt="USDT"
          width={icon}
          height={icon}
          className="rounded-full"
        />
        {/* Solana badge в правом нижнем углу */}
        <div
          className="absolute -bottom-0.5 -right-0.5 bg-[#1a0a2e] rounded-full p-0.5"
          style={{
            width: badge + 4,
            height: badge + 4,
          }}
        >
          <Image
            src="/sol.png"
            alt="Solana Network"
            width={badge}
            height={badge}
            className="rounded-full"
          />
        </div>
      </div>
    );
  }

  // FORTUNE
  return (
    <div className={`relative inline-block ${className}`}>
      <Image
        src="/fortune_coin.png"
        alt="Fortune"
        width={icon}
        height={icon}
        className="rounded-full"
      />
    </div>
  );
}
