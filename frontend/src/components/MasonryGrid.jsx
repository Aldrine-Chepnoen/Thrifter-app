// This is the MasonryGrid component for the Thrifter frontend application. It takes an array of items and renders them in a responsive masonry layout using Tailwind CSS utility classes. Each item is displayed using the ItemCard component, which is passed the item data and click handlers for item interactions. The grid adjusts the number of columns based on the screen size, providing a visually appealing layout for browsing items in the wardrobe.
import React, { useState, useEffect } from 'react';
import ItemCard from './ItemCard';

const MasonryGrid = ({ items, onItemClick, onRemove }) => {
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth >= 1024) setColumnCount(5);
      else if (window.innerWidth >= 768) setColumnCount(4);
      else if (window.innerWidth >= 640) setColumnCount(3);
      else setColumnCount(2);
    };
    
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Distribute items into columns
  const columns = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    columns[index % columnCount].push(item);
  });

  return (
    <div className="flex w-full gap-4 px-4 pb-20 box-border">
      {columns.map((columnItems, colIndex) => (
        <div key={colIndex} className="flex-1 min-w-0 space-y-4">
          {columnItems.map((item) => (
            <ItemCard 
              key={item.id} 
              item={item} 
              onClick={onItemClick} 
              onRemove={onRemove} 
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default MasonryGrid;
