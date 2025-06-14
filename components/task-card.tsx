"use client";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  Bookmark, 
  Trash2,
  Clock,
  ExternalLink,
  Share2
} from 'lucide-react';
import { Task } from '@/lib/indexeddb';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onToggleRead: (task: Task) => void;
  onToggleStock: (task: Task) => void;
  onDelete: (task: Task) => void;
  onShare: (task: Task) => void;
}

export function TaskCard({ task, onToggleRead, onToggleStock, onDelete, onShare }: TaskCardProps) {
  const [imageError, setImageError] = useState(false);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    
    return `${year}-${month}-${day} ${hours}:${minutes} (${weekday})`;
  };

  const handleTitleClick = () => {
    console.log('Title clicked:', { 
      url: task.url, 
      notionPageUrl: task.notionPageUrl,
      title: task.title 
    });
    
    // Try URL first, then fallback to notionPageUrl
    const targetUrl = task.url || task.notionPageUrl;
    
    if (targetUrl) {
      console.log('Opening URL:', targetUrl);
      window.open(targetUrl, '_blank');
    } else {
      console.log('No URL or notionPageUrl found for task');
    }
  };

  const handleNotionTagClick = () => {
    if (task.notionPageUrl && task.source === 'notion') {
      window.open(task.notionPageUrl, '_blank');
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 hover:shadow-lg border-border/50",
      "bg-card/50 backdrop-blur-sm",
      task.read && "opacity-60"
    )}>
      {(task.imageUrl || task.ogpImageUrl) && !imageError && (
        <div 
          className={cn(
            "aspect-video w-full overflow-hidden relative",
            (task.url || task.notionPageUrl) && "cursor-pointer"
          )}
          onClick={handleTitleClick}
        >
          <img
            src={task.ogpImageUrl || task.imageUrl}
            alt={task.title}
            className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
            onError={() => setImageError(true)}
          />
          {/* Click indicator for linked images */}
          {(task.url || task.notionPageUrl) && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
              <ExternalLink className="h-8 w-8 text-white opacity-0 hover:opacity-80 transition-opacity duration-200 drop-shadow-lg" />
            </div>
          )}
        </div>
      )}
      
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">
            {/* Title - clickable if URL or notionPageUrl exists */}
            <h3 
              className={cn(
                "font-semibold text-foreground leading-snug line-clamp-2",
                task.completed && "line-through text-muted-foreground",
                (task.url || task.notionPageUrl) && "cursor-pointer hover:text-primary transition-colors"
              )}
              onClick={handleTitleClick}
            >
              {task.title}
              {(task.url || task.notionPageUrl) && (
                <ExternalLink className="inline h-3 w-3 ml-1 opacity-60" />
              )}
            </h3>
          </div>
        </div>

        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDate(task.createdAt)}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Tags display */}
            {task.tags && task.tags.length > 0 && (
              <>
                {task.tags.slice(0, 3).map((tag, index) => (
                  <Badge 
                    key={index}
                    variant="outline" 
                    className="text-xs cursor-pointer hover:bg-muted"
                    onClick={() => {
                      if (task.source === 'notion' && task.notionPageUrl) {
                        window.open(task.notionPageUrl, '_blank');
                      }
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
                {task.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{task.tags.length - 3}
                  </Badge>
                )}
              </>
            )}
            
            <Badge 
              variant={task.source === 'notion' ? 'default' : 'secondary'}
              className={cn(
                "text-xs",
                task.source === 'notion' && task.notionPageUrl && "cursor-pointer hover:bg-primary/80"
              )}
              onClick={task.source === 'notion' ? handleNotionTagClick : undefined}
            >
              {task.source === 'notion' ? 'Notion' : 'GTasks'}
            </Badge>
            
            {task.stocked && (
              <Badge variant="outline" className="text-xs">
                <Bookmark className="h-3 w-3 mr-1" />
                Stock
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleRead(task)}
            className={cn(
              "flex items-center gap-2 text-muted-foreground hover:text-foreground",
              task.read && "text-primary"
            )}
          >
            <Check className={cn("h-4 w-4", task.read && "fill-current")} />
            <span className="text-xs">{task.read ? '既読' : '未読'}</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleStock(task)}
            className={cn(
              "flex items-center gap-2 text-muted-foreground hover:text-foreground",
              task.stocked && "text-primary"
            )}
          >
            <Bookmark className={cn("h-4 w-4", task.stocked && "fill-current")} />
            <span className="text-xs">{task.stocked ? 'ストック済' : 'ストック'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShare(task)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
            <span className="text-xs">共有</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(task)}
            className="flex items-center gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-xs">削除</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}