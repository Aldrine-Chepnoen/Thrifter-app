// This is the MasonryGrid component for the Thrifter frontend application. It takes an array of items and renders them in a responsive masonry layout using Tailwind CSS utility classes. Each item is displayed using the ItemCard component, which is passed the item data and click handlers for item interactions. The grid adjusts the number of columns based on the screen size, providing a visually appealing layout for browsing items in the wardrobe.
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
