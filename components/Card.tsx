import React from 'react';
import Link from 'next/link';

interface CardProps {
  title: string;
  description: string;
  imageUrl?: string;
  link?: string;
}

export const Card: React.FC<CardProps> = ({ title, description, imageUrl, link }) => {
  const containerClasses =
    'rounded-xl bg-white bg-opacity-10 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 flex flex-col h-full';
  const image = imageUrl ? (
    <div className="mb-4 h-40 overflow-hidden rounded-md">
      <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
    </div>
  ) : null;

  const content = (
    <>
      <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
      <p className="text-sm text-white/80 flex-grow mb-4">{description}</p>
    </>
  );

  return (
    <div className={containerClasses}>
      {image}
      {content}
      {link && (
        <Link href={link} className="mt-auto text-sm font-medium text-indigo-300 hover:underline self-start">
          查看更多 →
        </Link>
      )}
    </div>
  );
};
