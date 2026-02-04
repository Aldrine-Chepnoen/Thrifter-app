import React from 'react';
import ItemCard from './ItemCard';

const MasonryGrid = ({ items, onItemClick, onRemove }) => {
  return (
    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4 px-4 pb-20">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onClick={onItemClick} onRemove={onRemove} />
      ))}
    </div>
  );
};

export default MasonryGrid;
