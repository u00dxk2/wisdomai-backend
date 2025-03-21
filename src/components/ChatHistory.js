import React, { useState, useEffect } from 'react';
import { getChatHistory, deleteChat } from '../services/chatService';
import { formatDistanceToNow } from 'date-fns';
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Paper,
  Box,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Chat as ChatIcon
} from '@mui/icons-material';

const ChatHistory = ({ onSelectChat, selectedChatId }) => {
  const [chats, setChats] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const history = await getChatHistory();
      setChats(history);
      setError(null);
    } catch (err) {
      setError('Failed to load chat history');
      console.error('Error loading chat history:', err);
    }
  };

  const handleDeleteChat = async (chatId, event) => {
    event.stopPropagation();
    try {
      await deleteChat(chatId);
      setChats(chats.filter(chat => chat._id !== chatId));
      if (selectedChatId === chatId) {
        onSelectChat(null);
      }
    } catch (err) {
      setError('Failed to delete chat');
      console.error('Error deleting chat:', err);
    }
  };

  if (error) {
    return (
      <Typography color="error" align="center">
        {error}
      </Typography>
    );
  }

  return (
    <Paper elevation={2}>
      <Box p={2}>
        <Typography variant="h6" gutterBottom>
          Chat History
        </Typography>
        <Divider />
        <List>
          {chats.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No chat history"
                secondary="Start a new conversation to see it here"
              />
            </ListItem>
          ) : (
            chats.map(chat => (
              <ListItem
                key={chat._id}
                button
                selected={selectedChatId === chat._id}
                onClick={() => onSelectChat(chat._id)}
                sx={{
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                  borderRadius: 1,
                  mb: 1
                }}
              >
                <ChatIcon sx={{ mr: 2, color: 'primary.main' }} />
                <ListItemText
                  primary={chat.title}
                  secondary={`Last updated ${formatDistanceToNow(new Date(chat.lastUpdated))} ago`}
                  primaryTypographyProps={{
                    noWrap: true,
                    style: { maxWidth: '70%' }
                  }}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Delete chat">
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={(e) => handleDeleteChat(chat._id, e)}
                      sx={{
                        '&:hover': {
                          color: 'error.main'
                        }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </Box>
    </Paper>
  );
};

export default ChatHistory; 