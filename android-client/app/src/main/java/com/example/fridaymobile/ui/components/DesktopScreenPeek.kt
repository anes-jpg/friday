package com.example.fridaymobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DesktopWindows
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.fridaymobile.theme.*

@Composable
fun DesktopScreenPeek(
  screenPeekUrl: String?,
  onRefresh: () -> Unit,
  modifier: Modifier = Modifier
) {
  var isExpanded by remember { mutableStateOf(false) }
  var showFullscreenDialog by remember { mutableStateOf(false) }

  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = ColorPlate,
    border = CardDefaults.outlinedCardBorder().copy(
      brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
    )
  ) {
    Column(modifier = Modifier.padding(14.dp)) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .clickable { isExpanded = !isExpanded },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Icon(
            imageVector = Icons.Default.DesktopWindows,
            contentDescription = "Desktop Peek",
            tint = TextSecondary,
            modifier = Modifier.size(15.dp)
          )
          Text(
            text = "SCREEN PEEK",
            color = TextSecondary,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp
          )
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
          IconButton(
            onClick = onRefresh,
            modifier = Modifier.size(28.dp)
          ) {
            Icon(
              imageVector = Icons.Default.Refresh,
              contentDescription = "Refresh Screen",
              tint = TextSecondary,
              modifier = Modifier.size(15.dp)
            )
          }
          Text(
            text = if (isExpanded) "Hide" else "Show",
            color = ColorSignal,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(start = 6.dp)
          )
        }
      }

      AnimatedVisibility(visible = isExpanded) {
        Column(modifier = Modifier.padding(top = 10.dp)) {
          if (screenPeekUrl.isNullOrBlank()) {
            Box(
              modifier = Modifier
                .fillMaxWidth()
                .height(130.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(ColorVoid)
                .border(1.dp, ColorPlateBorder, RoundedCornerShape(10.dp)),
              contentAlignment = Alignment.Center
            ) {
              Text(
                text = "Tap refresh to snapshot Windows screen",
                color = TextMuted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp
              )
            }
          } else {
            AsyncImage(
              model = ImageRequest.Builder(LocalContext.current)
                .data(screenPeekUrl)
                .crossfade(true)
                .build(),
              contentDescription = "Desktop Screen",
              contentScale = ContentScale.Crop,
              modifier = Modifier
                .fillMaxWidth()
                .height(160.dp)
                .clip(RoundedCornerShape(10.dp))
                .border(1.dp, ColorPlateBorder, RoundedCornerShape(10.dp))
                .clickable { showFullscreenDialog = true }
            )
          }
        }
      }
    }
  }

  // Full-Screen Modal
  if (showFullscreenDialog && !screenPeekUrl.isNullOrBlank()) {
    Dialog(onDismissRequest = { showFullscreenDialog = false }) {
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .wrapContentHeight()
          .clip(RoundedCornerShape(16.dp))
          .background(ColorVoid)
          .border(1.dp, ColorPlateBorder, RoundedCornerShape(16.dp))
          .padding(8.dp)
      ) {
        Column {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "Live Desktop Preview",
              color = TextPrimary,
              fontFamily = FontFamily.Monospace,
              fontWeight = FontWeight.Bold,
              fontSize = 13.sp
            )
            IconButton(
              onClick = { showFullscreenDialog = false },
              modifier = Modifier.size(24.dp)
            ) {
              Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "Close",
                tint = TextSecondary
              )
            }
          }
          AsyncImage(
            model = screenPeekUrl,
            contentDescription = "Full Screen Desktop",
            contentScale = ContentScale.Fit,
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(10.dp))
          )
        }
      }
    }
  }
}
